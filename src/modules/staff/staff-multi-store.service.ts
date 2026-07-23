import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { StaffStore } from './entities/staff-store.entity';
import { Staff } from './entities/staff.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

@Injectable()
export class StaffMultiStoreService {
  private readonly logger = new Logger(StaffMultiStoreService.name);

  constructor(
    @InjectRepository(StaffStore)
    private readonly staffStoreRepo: Repository<StaffStore>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async getStaffStores(
    staffId: number,
    currentStoreId?: number,
  ): Promise<
    { store_id: number; store_name: string; role_in_store: string; is_current: boolean; assigned_at: string }[]
  > {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, deleted_at: IsNull() } });
    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
    }

    const relations = await this.staffStoreRepo.find({
      where: { staff_id: staffId, deleted_at: IsNull() },
    });

    if (relations.length === 0) {
      return [];
    }

    const storeIds = relations.map((r) => r.store_id);
    const stores = await this.storeRepo.find({
      where: { id: In(storeIds), deleted_at: IsNull() },
      select: ['id', 'name'],
    });

    const storeNameMap = new Map(stores.map((s) => [Number(s.id), s.name]));

    return relations.map((r) => ({
      store_id: Number(r.store_id),
      store_name: storeNameMap.get(Number(r.store_id)) ?? '未知门店',
      role_in_store: r.role_in_store,
      is_current: currentStoreId !== undefined ? Number(r.store_id) === currentStoreId : false,
      assigned_at: r.assigned_at.toISOString(),
    }));
  }

  async getStoreStaff(
    storeId: number,
  ): Promise<{ staff_id: number; name: string; phone: string; role_in_store: string }[]> {
    const store = await this.storeRepo.findOne({ where: { id: storeId, deleted_at: IsNull() } });
    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '门店不存在');
    }

    const relations = await this.staffStoreRepo.find({
      where: { store_id: storeId, deleted_at: IsNull() },
    });

    if (relations.length === 0) {
      return [];
    }

    const staffIds = relations.map((r) => r.staff_id);
    const staffList = await this.staffRepo.find({
      where: { id: In(staffIds), deleted_at: IsNull() },
      select: ['id', 'name', 'phone'],
    });

    const roleMap = new Map(relations.map((r) => [Number(r.staff_id), r.role_in_store]));

    return staffList.map((s) => ({
      staff_id: Number(s.id),
      name: s.name,
      phone: s.phone,
      role_in_store: roleMap.get(Number(s.id)) ?? 'staff',
    }));
  }

  async assignStores(staffId: number, storeIds: number[], roles?: Record<number, 'staff' | 'manager'>): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, deleted_at: IsNull() } });
    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
    }

    // Validate all store IDs exist
    const validStores = await this.storeRepo.find({
      where: { id: In(storeIds), deleted_at: IsNull() },
      select: ['id'],
    });

    if (validStores.length !== storeIds.length) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '存在无效的门店ID');
    }

    // Transaction: soft-delete old relations, insert new ones
    await this.staffStoreRepo.manager.transaction(async (manager) => {
      // Soft-delete old relations
      await manager.update(StaffStore, { staff_id: staffId, deleted_at: IsNull() }, {
        deleted_at: new Date(),
      } as Partial<StaffStore>);

      // Insert new relations
      const now = new Date();
      const entities = storeIds.map((storeId) =>
        manager.create(StaffStore, {
          staff_id: staffId,
          store_id: storeId,
          role_in_store: roles?.[storeId] ?? 'staff',
          assigned_at: now,
          created_at: now,
        }),
      );
      await manager.save(StaffStore, entities);

      // If current_store_id is not in the new store_ids, switch to first
      const numericCurrent = Number(staff.current_store_id);
      if (!storeIds.includes(numericCurrent)) {
        await manager.update(Staff, { id: staffId }, { current_store_id: storeIds[0] } as Partial<Staff>);
      }
    });

    this.logger.log(`Staff ${staffId} stores assigned: ${storeIds.join(',')}`);
  }
}
