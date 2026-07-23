import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StaffMultiStoreService } from './staff-multi-store.service';
import { StaffStore } from './entities/staff-store.entity';
import { Staff } from './entities/staff.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('StaffMultiStoreService', () => {
  let service: StaffMultiStoreService;
  let staffStoreRepo: jest.Mocked<Repository<StaffStore>>;
  let staffRepo: jest.Mocked<Repository<Staff>>;
  let storeRepo: jest.Mocked<Repository<Store>>;

  const mockStaff = {
    id: 1,
    store_id: 1,
    current_store_id: 1,
    name: 'Test Staff',
    phone: '13800138000',
    password_hash: '',
    role: 'staff' as const,
    avatar: null,
    status: 'active' as const,
    token_version: 0,
    wechat_openid: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    staffStores: [],
  };

  const mockStore = {
    id: 1,
    name: 'Store 1',
    address: '123 Main St',
    location: null,
    business_hours: null,
    services_offered: null,
    capacity_config: null,
    region: null,
    phone: '021-12345678',
    logo: null,
    status: 'active' as const,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffMultiStoreService,
        {
          provide: getRepositoryToken(StaffStore),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            manager: {
              transaction: jest.fn((cb: (...args: unknown[]) => unknown) =>
                cb({
                  update: jest.fn(),
                  create: jest.fn().mockReturnValue({}),
                  save: jest.fn(),
                  find: jest.fn(),
                }),
              ),
            },
          },
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StaffMultiStoreService>(StaffMultiStoreService);
    staffStoreRepo = module.get(getRepositoryToken(StaffStore));
    staffRepo = module.get(getRepositoryToken(Staff));
    storeRepo = module.get(getRepositoryToken(Store));
  });

  describe('getStaffStores', () => {
    it('should return staff stores with names', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      staffStoreRepo.find.mockResolvedValue([
        {
          id: 1,
          staff_id: 1,
          store_id: 1,
          role_in_store: 'staff',
          assigned_at: new Date(),
          created_at: new Date(),
          deleted_at: null,
        } as StaffStore,
      ]);
      storeRepo.find.mockResolvedValue([mockStore as Store]);

      const result = await service.getStaffStores(1);

      expect(result).toHaveLength(1);
      expect(result[0].store_name).toBe('Store 1');
      expect(result[0].role_in_store).toBe('staff');
    });

    it('should throw when staff not found', async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(service.getStaffStores(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('getStoreStaff', () => {
    it('should return staff for a store', async () => {
      storeRepo.findOne.mockResolvedValue(mockStore as Store);
      staffStoreRepo.find.mockResolvedValue([
        {
          id: 1,
          staff_id: 1,
          store_id: 1,
          role_in_store: 'staff',
          assigned_at: new Date(),
          created_at: new Date(),
          deleted_at: null,
        } as StaffStore,
      ]);
      staffRepo.find.mockResolvedValue([mockStaff as Staff]);

      const result = await service.getStoreStaff(1);

      expect(result).toHaveLength(1);
    });

    it('should throw when store not found', async () => {
      storeRepo.findOne.mockResolvedValue(null);

      await expect(service.getStoreStaff(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('assignStores', () => {
    it('should assign stores within transaction', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      storeRepo.find.mockResolvedValue([mockStore as Store]);

      await service.assignStores(1, [1]);

      expect(staffStoreRepo.manager.transaction).toHaveBeenCalled();
    });

    it('should throw when invalid store IDs provided', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      storeRepo.find.mockResolvedValue([]);

      await expect(service.assignStores(1, [999])).rejects.toThrow(BusinessException);
    });
  });
});
