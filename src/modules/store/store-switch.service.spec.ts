import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository, UpdateResult } from 'typeorm';
import { StoreSwitchService } from './store-switch.service';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Store } from './entities/store.entity';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('StoreSwitchService', () => {
  let service: StoreSwitchService;
  let staffStoreRepo: jest.Mocked<Repository<StaffStore>>;
  let staffRepo: jest.Mocked<Repository<Staff>>;
  let storeRepo: jest.Mocked<Repository<Store>>;

  const mockStore: Store = {
    id: 1,
    name: 'Store 1',
    address: 'Address',
    location: null,
    business_hours: null,
    services_offered: null,
    capacity_config: null,
    region: null,
    phone: '021-12345678',
    logo: null,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as Store;

  const mockStaff: Staff = {
    id: 1,
    store_id: 1,
    current_store_id: 1,
    name: 'Staff 1',
    phone: '13800138000',
    password_hash: '',
    role: 'staff',
    avatar: null,
    status: 'active',
    token_version: 0,
    wechat_openid: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    staffStores: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreSwitchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'JWT_ACCESS_SECRET' ? 'secret' : key === 'JWT_REFRESH_SECRET' ? 'refresh-secret' : undefined,
            ),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { blacklistJwt: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(StaffStore),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Store),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StoreSwitchService>(StoreSwitchService);
    staffStoreRepo = module.get(getRepositoryToken(StaffStore));
    staffRepo = module.get(getRepositoryToken(Staff));
    storeRepo = module.get(getRepositoryToken(Store));
  });

  describe('switch', () => {
    it('should switch store and return new token', async () => {
      staffStoreRepo.findOne.mockResolvedValue({
        id: 1,
        staff_id: 1,
        store_id: 1,
        role_in_store: 'staff',
        assigned_at: new Date(),
        created_at: new Date(),
        deleted_at: null,
      } as StaffStore);
      storeRepo.findOne.mockResolvedValue(mockStore);
      staffRepo.update.mockResolvedValue({ affected: 1 } as unknown as UpdateResult);
      staffRepo.findOne.mockResolvedValue(mockStaff);

      const result = await service.switch(1, 1);

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.storeId).toBe(1);
      expect(result.storeName).toBe('Store 1');
    });

    it('should throw when staff does not belong to store', async () => {
      staffStoreRepo.findOne.mockResolvedValue(null);

      await expect(service.switch(1, 999)).rejects.toThrow(BusinessException);
    });

    it('should throw when target store does not exist', async () => {
      staffStoreRepo.findOne.mockResolvedValue({
        id: 1,
        staff_id: 1,
        store_id: 999,
        role_in_store: 'staff',
        assigned_at: new Date(),
        created_at: new Date(),
        deleted_at: null,
      } as StaffStore);
      storeRepo.findOne.mockResolvedValue(null);

      await expect(service.switch(1, 999)).rejects.toThrow(BusinessException);
    });
  });

  describe('getCurrentStoreInfo', () => {
    it('should return current store info', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff);
      storeRepo.findOne.mockResolvedValue(mockStore);

      const result = await service.getCurrentStoreInfo(1);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Store 1');
    });

    it('should return null when staff not found', async () => {
      staffRepo.findOne.mockResolvedValue(null);

      const result = await service.getCurrentStoreInfo(999);

      expect(result).toBeNull();
    });
  });
});
