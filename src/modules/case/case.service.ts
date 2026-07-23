import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource, QueryDeepPartialEntity } from 'typeorm';
import { Case } from './entities/case.entity';
import { CaseLike } from './entities/case-like.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateCaseDto, UpdateCaseDto } from './dto/create-case.dto';
import { QueryCaseDto } from './dto/query-case.dto';

@Injectable()
export class CaseService {
  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    @InjectRepository(CaseLike)
    private readonly caseLikeRepo: Repository<CaseLike>,
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCaseDto): Promise<Case> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    // Validate configuration exists and belongs to this store
    const config = await this.configRepo.findOne({
      where: { id: dto.configuration_id, store_id: storeId, deleted_at: IsNull() },
    });
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    // Validate config status is confirmed
    if (config.status !== 'confirmed') {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_CONFIRMED, '请先确认方案再发布案例');
    }

    // Check for duplicate case
    const existing = await this.caseRepo.findOne({
      where: { configuration_id: dto.configuration_id, deleted_at: IsNull() },
    });
    if (existing) {
      throw new BusinessException(ErrorCode.CONFIGURATION_ALREADY_QUOTED, '该方案已发布为案例');
    }

    const caseEntity = this.caseRepo.create({
      store_id: storeId,
      configuration_id: dto.configuration_id,
      title: sanitizeText(dto.title) ?? '',
      description: dto.description ? sanitizeText(dto.description) : undefined,
      cover_image_url: dto.cover_image_url ?? undefined,
      images: dto.images ?? undefined,
      status: 'published' as const,
      staff_id: staffId,
    });

    return await this.caseRepo.save(caseEntity);
  }

  /**
   * List published cases across all stores.
   * This is a public showcase endpoint — intentionally cross-store
   * so that customers can browse all published cases without authentication.
   */
  async findAll(query: QueryCaseDto): Promise<{ list: Case[]; total: number; page: number; size: number }> {
    const where: Record<string, unknown> = { deleted_at: IsNull() };

    if (query.status) {
      where.status = query.status;
    }

    const order: Record<string, string> = {};
    const allowedSorts = ['like_count', 'view_count', 'created_at'];
    const sortField = allowedSorts.includes(query.sort!) ? query.sort! : 'created_at';
    order[sortField] = 'DESC';

    const [list, total] = await this.caseRepo.findAndCount({
      where,
      skip: query.skip,
      take: query.take,
      order,
      relations: ['configuration'],
    });

    return { list, total, page: query.page ?? 1, size: query.size ?? 20 };
  }

  async findById(id: number): Promise<Case | null> {
    const caseEntity = await this.caseRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: [
        'configuration',
        'configuration.model',
        'configuration.model.series',
        'configuration.model.series.brand',
      ],
    });

    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    // Atomic view count increment
    await this.caseRepo.increment({ id }, 'view_count', 1);

    return caseEntity;
  }

  async update(id: number, dto: UpdateCaseDto): Promise<Case> {
    const storeId = StoreContext.getStoreId() as number;

    const caseEntity = await this.caseRepo.findOne({
      where: { id, store_id: storeId, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = sanitizeText(dto.title);
    if (dto.description !== undefined) updateData.description = sanitizeText(dto.description);
    if (dto.cover_image_url !== undefined) updateData.cover_image_url = dto.cover_image_url;
    if (dto.images !== undefined) updateData.images = dto.images;

    await this.caseRepo.update(id, updateData);

    return (await this.findById(id))!;
  }

  async delete(id: number): Promise<void> {
    const storeId = StoreContext.getStoreId() as number;

    const caseEntity = await this.caseRepo.findOne({
      where: { id, store_id: storeId, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    const now = new Date();
    await this.caseRepo.update(id, { deleted_at: now } as Partial<Case>);
  }

  async like(id: number, anonymousId?: string): Promise<{ like_count: number; is_liked: boolean }> {
    const storeId = StoreContext.getStoreId();
    const staffId = StoreContext.getStaffId();

    // Validate case exists
    const caseEntity = await this.caseRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const likeData: Record<string, unknown> = {
        store_id: storeId ?? caseEntity.store_id,
        case_id: id,
      };

      if (staffId) {
        likeData.staff_id = staffId;
      } else if (anonymousId) {
        likeData.anonymous_id = anonymousId;
      } else {
        throw new BusinessException(ErrorCode.VALIDATION_FAILED, '点赞需要登录或提供匿名标识');
      }

      // Idempotent like using ON DUPLICATE KEY / catch duplicate error
      try {
        await queryRunner.manager.insert(CaseLike, likeData as QueryDeepPartialEntity<CaseLike>);
        // Increment like_count
        await queryRunner.manager.increment(Case, { id }, 'like_count', 1);
      } catch (err) {
        // Duplicate entry — already liked, return success
        if (err.code === 'ER_DUP_ENTRY') {
          await queryRunner.commitTransaction();
          const updated = await this.caseRepo.findOne({ where: { id } });
          return { like_count: updated?.like_count ?? 0, is_liked: true };
        }
        throw err;
      }

      await queryRunner.commitTransaction();

      const updated = await this.caseRepo.findOne({ where: { id } });
      return { like_count: updated?.like_count ?? 0, is_liked: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
