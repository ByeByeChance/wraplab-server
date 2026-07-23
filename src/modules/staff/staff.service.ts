import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Staff } from './entities/staff.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  private readonly bcryptSaltRounds: number;

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {
    this.bcryptSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10) || 12;
  }

  async findByStore(): Promise<Staff[]> {
    const storeId = StoreContext.getStoreId();
    const isAdmin = StoreContext.isAdmin();

    const where: Record<string, unknown> = { deleted_at: IsNull() };
    if (!(isAdmin && storeId === null)) {
      where.store_id = storeId;
    }

    return this.staffRepo.find({
      where,
      select: ['id', 'store_id', 'name', 'phone', 'role', 'avatar', 'status', 'created_at', 'updated_at'],
      order: { created_at: 'DESC' },
    });
  }

  async create(dto: CreateStaffDto): Promise<Staff> {
    const storeId = StoreContext.getStoreId();
    if (!storeId) {
      throw new BusinessException(ErrorCode.FORBIDDEN, 'Admin 不能在全局范围内创建店员，请指定门店');
    }

    // Check phone uniqueness
    const existing = await this.staffRepo.findOne({ where: { phone: dto.phone } });
    if (existing) {
      throw new BusinessException(ErrorCode.PHONE_ALREADY_EXISTS, '该手机号已注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);

    const staff = this.staffRepo.create({
      store_id: storeId,
      name: dto.name,
      phone: dto.phone,
      password_hash: passwordHash,
      role: dto.role,
      avatar: dto.avatar ?? null,
      status: 'active',
      token_version: 0,
    });

    const saved = await this.staffRepo.save(staff);
    // Return without password_hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = saved as Staff & { password_hash: string };
    return result as Staff;
  }

  async update(id: number, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findStaffWithinStore(id);
    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      // If disabling, increment token_version to invalidate all tokens
      if (dto.status === 'disabled') {
        updateData.token_version = (staff.token_version || 0) + 1;
      }
    }

    if (dto.password) {
      updateData.password_hash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);
      // Increment token_version to invalidate all existing tokens
      updateData.token_version = (staff.token_version || 0) + 1;
    }

    await this.staffRepo.update(id, updateData);
    const updated = await this.staffRepo.findOne({
      where: { id },
      select: ['id', 'store_id', 'name', 'phone', 'role', 'avatar', 'status', 'created_at', 'updated_at'],
    });
    return updated!;
  }

  async disable(id: number): Promise<void> {
    const staff = await this.findStaffWithinStore(id);
    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
    }
    await this.staffRepo.update(id, {
      status: 'disabled',
      token_version: (staff.token_version || 0) + 1,
    } as Partial<Staff>);
  }

  private async findStaffWithinStore(id: number): Promise<Staff | null> {
    const storeId = StoreContext.getStoreId();
    const isAdmin = StoreContext.isAdmin();

    const where: Record<string, unknown> = { id, deleted_at: IsNull() };
    if (!(isAdmin && storeId === null)) {
      where.store_id = storeId;
    }

    return this.staffRepo.findOne({ where });
  }
}
