import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Not, FindOptionsWhere } from 'typeorm';
import { CaseTag } from './entities/case-tag.entity';
import { CaseTagRelation } from './entities/case-tag-relation.entity';
import { Case } from './entities/case.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { CreateTagDto } from '../admin/dto/create-tag.dto';
import { SetCaseTagsDto } from '../admin/dto/set-case-tags.dto';

@Injectable()
export class CaseTagService {
  constructor(
    @InjectRepository(CaseTag)
    private readonly tagRepo: Repository<CaseTag>,
    @InjectRepository(CaseTagRelation)
    private readonly relationRepo: Repository<CaseTagRelation>,
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
  ) {}

  async getPublicTags(storeId?: number): Promise<CaseTag[]> {
    if (storeId) {
      return this.tagRepo.find({
        where: [
          { store_id: storeId, deleted_at: IsNull() },
          { store_id: IsNull(), deleted_at: IsNull() },
        ] as FindOptionsWhere<CaseTag>[],
        order: { sort_order: 'ASC', created_at: 'DESC' },
      });
    }
    return this.tagRepo.find({
      where: { deleted_at: IsNull() } as FindOptionsWhere<CaseTag>,
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });
  }

  async getAdminTags(storeId?: number, keyword?: string): Promise<CaseTag[]> {
    const qb = this.tagRepo.createQueryBuilder('t').where('t.deleted_at IS NULL');

    if (storeId) {
      qb.andWhere('(t.store_id = :storeId OR t.store_id IS NULL)', { storeId });
    }
    if (keyword) {
      qb.andWhere('t.name LIKE :keyword', { keyword: `%${keyword}%` });
    }

    return qb.orderBy('t.sort_order', 'ASC').addOrderBy('t.created_at', 'DESC').getMany();
  }

  async create(dto: CreateTagDto): Promise<CaseTag> {
    // Check duplicate name
    const existing = await this.tagRepo.findOne({
      where: {
        name: dto.name,
        store_id: dto.store_id !== undefined ? dto.store_id : IsNull(),
        deleted_at: IsNull(),
      } as FindOptionsWhere<CaseTag>,
    });
    if (existing) {
      throw new BusinessException(ErrorCode.TAG_ALREADY_EXISTS, '标签名称已存在');
    }

    const tag = this.tagRepo.create({
      name: dto.name,
      color: dto.color ?? '#1890FF',
      sort_order: dto.sort_order ?? 0,
      store_id: dto.store_id ?? null,
    });

    return this.tagRepo.save(tag);
  }

  async update(id: number, dto: CreateTagDto): Promise<CaseTag> {
    const tag = await this.tagRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!tag) {
      throw new BusinessException(ErrorCode.TAG_NOT_FOUND, '标签不存在');
    }

    // Check duplicate name
    if (dto.name && dto.name !== tag.name) {
      const existing = await this.tagRepo.findOne({
        where: {
          name: dto.name,
          store_id: dto.store_id !== undefined ? dto.store_id : IsNull(),
          deleted_at: IsNull(),
          id: Not(id),
        } as FindOptionsWhere<CaseTag>,
      });
      if (existing) {
        throw new BusinessException(ErrorCode.TAG_ALREADY_EXISTS, '标签名称已存在');
      }
    }

    await this.tagRepo.update(id, dto as Partial<CaseTag>);
    return this.tagRepo.findOneByOrFail({ id });
  }

  async delete(id: number): Promise<void> {
    const tag = await this.tagRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!tag) {
      throw new BusinessException(ErrorCode.TAG_NOT_FOUND, '标签不存在');
    }

    await this.tagRepo.manager.transaction(async (manager) => {
      // Soft-delete tag
      await manager.update(CaseTag, id, { deleted_at: new Date() } as Partial<CaseTag>);
      // Cascade delete relations
      await manager.delete(CaseTagRelation, { tag_id: id });
    });
  }

  async setCaseTags(caseId: number, dto: SetCaseTagsDto): Promise<void> {
    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
    });
    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    // Validate all tags exist
    const validTags = await this.tagRepo.find({
      where: { id: In(dto.tag_ids), deleted_at: IsNull() },
    });
    if (validTags.length !== dto.tag_ids.length) {
      throw new BusinessException(ErrorCode.TAG_NOT_FOUND, '部分标签不存在');
    }

    await this.relationRepo.manager.transaction(async (manager) => {
      // Delete old relations
      await manager.delete(CaseTagRelation, { case_id: caseId });
      // Insert new relations
      const relations = dto.tag_ids.map((tagId) => manager.create(CaseTagRelation, { case_id: caseId, tag_id: tagId }));
      await manager.save(CaseTagRelation, relations);
    });
  }

  async getTagsForCase(caseId: number): Promise<CaseTag[]> {
    const relations = await this.relationRepo.find({
      where: { case_id: caseId },
    });

    if (relations.length === 0) return [];

    const tagIds = relations.map((r) => r.tag_id);
    return this.tagRepo.find({
      where: { id: In(tagIds), deleted_at: IsNull() },
      order: { sort_order: 'ASC' },
    });
  }
}
