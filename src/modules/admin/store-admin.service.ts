import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Store } from '../store/entities/store.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { QueryStoreDto } from './dto/query-store.dto';

@Injectable()
export class StoreAdminService {
  private readonly logger = new Logger(StoreAdminService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(StaffStore)
    private readonly staffStoreRepo: Repository<StaffStore>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}

  async create(dto: CreateStoreDto): Promise<Store> {
    // Check for duplicate name
    const existing = await this.storeRepo.findOne({
      where: { name: dto.name, deleted_at: IsNull() },
    });
    if (existing) {
      throw new BusinessException(ErrorCode.DUPLICATE_STORE_NAME, '门店名称已存在');
    }

    const store = this.storeRepo.create({
      name: dto.name,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      location: dto.location ?? null,
      business_hours: dto.business_hours ?? null,
      services_offered: dto.services_offered ?? null,
      capacity_config: dto.capacity_config ?? null,
      region: dto.region ?? null,
      status: 'active',
    } as Partial<Store>);

    return this.storeRepo.save(store);
  }

  async findAll(query: QueryStoreDto): Promise<{ items: Store[]; total: number; page: number; size: number }> {
    const where: Record<string, unknown> = { deleted_at: IsNull() };

    if (query.status) {
      where.status = query.status;
    }
    if (query.region) {
      where.region = query.region;
    }

    const qb = this.storeRepo.createQueryBuilder('store').where('store.deleted_at IS NULL');

    if (query.status) {
      qb.andWhere('store.status = :status', { status: query.status });
    }
    if (query.region) {
      qb.andWhere('store.region = :region', { region: query.region });
    }
    if (query.keyword) {
      qb.andWhere('(store.name LIKE :keyword OR store.address LIKE :keyword)', {
        keyword: `%${query.keyword}%`,
      });
    }

    qb.orderBy('store.created_at', 'DESC');

    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const [items, total] = await qb.skip(skip).take(size).getManyAndCount();

    return { items, total, page, size };
  }

  async findById(id: number): Promise<Store> {
    const store = await this.storeRepo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '门店不存在');
    }
    return store;
  }

  async update(id: number, dto: UpdateStoreDto): Promise<Store> {
    const store = await this.findById(id);

    // Check duplicate name if name is being updated
    if (dto.name && dto.name !== store.name) {
      const existing = await this.storeRepo.findOne({
        where: { name: dto.name, deleted_at: IsNull(), id: Not(id) },
      });
      if (existing) {
        throw new BusinessException(ErrorCode.DUPLICATE_STORE_NAME, '门店名称已存在');
      }
    }

    // If deactivating, check for active appointments
    if (dto.status === 'inactive' && store.status === 'active') {
      // Deactivation just sets status, doesn't require active appointment check
      // per the architecture doc P5.3.4
    }

    await this.storeRepo.update(id, dto as Partial<Store>);
    return this.storeRepo.findOneByOrFail({ id });
  }

  async delete(id: number): Promise<void> {
    await this.findById(id);

    // Find affected staff (those whose current_store_id equals this store)
    const affectedStaff = await this.staffRepo.find({
      where: { current_store_id: id, deleted_at: IsNull() },
      select: ['id'],
    });

    await this.storeRepo.manager.transaction(async (manager) => {
      // Reassign each affected staff to their first remaining store
      for (const staff of affectedStaff) {
        const remainingStore = await manager.findOne(StaffStore, {
          where: { staff_id: staff.id, deleted_at: IsNull() },
          select: ['store_id'],
          order: { assigned_at: 'ASC' },
        });

        if (remainingStore && Number(remainingStore.store_id) !== id) {
          await manager.update(Staff, staff.id, {
            current_store_id: remainingStore.store_id,
          } as Partial<Staff>);
        } else {
          // No remaining store; set current_store_id to null
          await manager.update(Staff, staff.id, {
            current_store_id: null as unknown as number,
          } as Partial<Staff>);
        }
      }

      // Soft-delete staff_store rows for this store
      await manager.update(StaffStore, { store_id: id, deleted_at: IsNull() }, {
        deleted_at: new Date(),
      } as Partial<StaffStore>);

      // Soft-delete store
      await manager.update(Store, { id }, {
        deleted_at: new Date(),
        status: 'inactive',
      } as Partial<Store>);
    });

    this.logger.log(`Store ${id} soft-deleted, ${affectedStaff.length} staff reassigned`);
  }
}
