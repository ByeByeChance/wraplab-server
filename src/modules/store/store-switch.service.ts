import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import * as crypto from 'crypto';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Store } from './entities/store.entity';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

@Injectable()
export class StoreSwitchService {
  private readonly logger = new Logger(StoreSwitchService.name);

  constructor(
    @InjectRepository(StaffStore)
    private readonly staffStoreRepo: Repository<StaffStore>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async getAvailableStores(
    staffId: number,
  ): Promise<{ store_id: number; store_name: string; role_in_store: string }[]> {
    const relations = await this.staffStoreRepo.find({
      where: { staff_id: staffId, deleted_at: IsNull() },
    });

    if (relations.length === 0) {
      return [];
    }

    const storeIds = relations.map((r) => r.store_id);
    const stores = await this.storeRepo.find({
      where: { id: In(storeIds), deleted_at: IsNull(), status: 'active' },
      select: ['id', 'name'],
    });

    const storeNameMap = new Map(stores.map((s) => [Number(s.id), s.name]));

    return relations
      .filter((r) => storeNameMap.has(Number(r.store_id)))
      .map((r) => ({
        store_id: Number(r.store_id),
        store_name: storeNameMap.get(Number(r.store_id)) ?? '未知门店',
        role_in_store: r.role_in_store,
      }));
  }

  async switch(
    staffId: number,
    targetStoreId: number,
    oldJti?: string,
    oldExp?: number,
  ): Promise<{ accessToken: string; refreshToken: string; storeId: number; storeName: string }> {
    // Validate staff belongs to target store
    const relation = await this.staffStoreRepo.findOne({
      where: { staff_id: staffId, store_id: targetStoreId, deleted_at: IsNull() },
    });

    if (!relation) {
      throw new BusinessException(ErrorCode.STORE_SWITCH_FORBIDDEN, '您不属于该门店，无法切换');
    }

    // Validate target store exists and is active
    const store = await this.storeRepo.findOne({
      where: { id: targetStoreId, deleted_at: IsNull(), status: 'active' },
    });

    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '目标门店不存在或已停用');
    }

    // Blacklist old JWT if available
    if (oldJti && oldExp) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const remainingTtl = Math.max(oldExp - nowInSeconds, 1);
      try {
        await this.redisService.blacklistJwt(oldJti, remainingTtl);
      } catch (err) {
        this.logger.warn(`Failed to blacklist old JWT ${oldJti}, proceeding with switch`, (err as Error)?.message);
      }
    }

    // Update current_store_id
    await this.staffRepo.update(staffId, { current_store_id: targetStoreId } as Partial<Staff>);

    // Get staff info for new JWT
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, deleted_at: IsNull() },
      select: ['id', 'current_store_id', 'role', 'phone', 'token_version'],
    });

    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
    }

    // Issue new JWT
    const payload = {
      sub: staff.id,
      store_id: Number(staff.current_store_id),
      role: staff.role,
      phone: staff.phone,
      token_version: staff.token_version,
      jti: crypto.randomUUID(),
    };

    const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '7200', 10);
    const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    this.logger.log(`Staff ${staffId} switched to store ${targetStoreId}`);

    return {
      accessToken,
      refreshToken,
      storeId: Number(store.id),
      storeName: store.name,
    };
  }

  async getCurrentStoreInfo(
    staffId: number,
  ): Promise<{ id: number; name: string; address: string; phone: string } | null> {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, deleted_at: IsNull() },
      select: ['current_store_id'],
    });

    if (!staff) {
      return null;
    }

    const store = await this.storeRepo.findOne({
      where: { id: Number(staff.current_store_id), deleted_at: IsNull() },
    });

    if (!store) {
      return null;
    }

    return {
      id: Number(store.id),
      name: store.name,
      address: store.address ?? '',
      phone: store.phone ?? '',
    };
  }
}
