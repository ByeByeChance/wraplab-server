import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
  ) {}

  async add(configId: number): Promise<Favorite> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    // Validate configuration exists
    const config = await this.configRepo.findOne({
      where: { id: configId, store_id: storeId, deleted_at: IsNull() },
    });
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    // Idempotent: check if already favorited
    const existing = await this.favoriteRepo.findOne({
      where: { staff_id: staffId, configuration_id: configId },
    });
    if (existing) {
      return existing;
    }

    const favorite = this.favoriteRepo.create({
      store_id: storeId,
      staff_id: staffId,
      configuration_id: configId,
    });

    return this.favoriteRepo.save(favorite);
  }

  async remove(configId: number): Promise<void> {
    const staffId = StoreContext.getStaffId();

    const favorite = await this.favoriteRepo.findOne({
      where: { staff_id: staffId, configuration_id: configId },
    });
    if (!favorite) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '收藏不存在');
    }

    await this.favoriteRepo.remove(favorite);
  }

  async findAll(pagination: PaginationDto): Promise<{ list: Favorite[]; total: number; page: number; size: number }> {
    const staffId = StoreContext.getStaffId();

    const [list, total] = await this.favoriteRepo.findAndCount({
      where: { staff_id: staffId },
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
      relations: [
        'configuration',
        'configuration.model',
        'configuration.model.series',
        'configuration.model.series.brand',
      ],
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async isFavorited(configId: number): Promise<boolean> {
    const staffId = StoreContext.getStaffId();
    const count = await this.favoriteRepo.count({
      where: { staff_id: staffId, configuration_id: configId },
    });
    return count > 0;
  }
}
