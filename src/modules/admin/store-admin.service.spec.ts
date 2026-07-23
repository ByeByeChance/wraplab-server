import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StoreAdminService } from './store-admin.service';
import { Store } from '../store/entities/store.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('StoreAdminService', () => {
  let service: StoreAdminService;
  let storeRepo: jest.Mocked<Pick<Repository<Store>, 'findOne' | 'findOneByOrFail' | 'create' | 'save' | 'update' | 'createQueryBuilder'>>;
  let staffStoreRepo: jest.Mocked<Pick<Repository<StaffStore>, 'manager'>>;
  let staffRepo: jest.Mocked<Pick<Repository<Staff>, 'find'>>;

  const mockStore: Partial<Store> = {
    id: 1,
    name: 'Test Store',
    address: '123 Test St',
    phone: '13800138000',
    location: { lat: 31.2304, lng: 121.4737 },
    business_hours: null,
    services_offered: null,
    capacity_config: null,
    region: '上海',
    logo: null,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockStaff: Partial<Staff> = {
    id: 1,
    store_id: 1,
    current_store_id: 1,
    name: 'Test Staff',
    phone: '13800138001',
    password_hash: 'hash',
    role: 'staff',
    status: 'active',
    token_version: 0,
    wechat_openid: null,
    avatar: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const mockManager = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreAdminService,
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOne: jest.fn(),
            findOneByOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(StaffStore),
          useValue: {
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StoreAdminService>(StoreAdminService);
    storeRepo = module.get(getRepositoryToken(Store));
    staffStoreRepo = module.get(getRepositoryToken(StaffStore));
    staffRepo = module.get(getRepositoryToken(Staff));
  });

  describe('create', () => {
    it('should create a new store', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(null);
      (storeRepo.create as jest.Mock).mockReturnValue(mockStore as Store);
      (storeRepo.save as jest.Mock).mockResolvedValue(mockStore as Store);

      const result = await service.create({ name: 'Test Store', address: '123 Test St' });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Store');
      expect(result.status).toBe('active');
      expect(storeRepo.save).toHaveBeenCalled();
    });

    it('should throw when store name already exists', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(mockStore as Store);

      await expect(service.create({ name: 'Test Store' })).rejects.toThrow(BusinessException);
    });
  });

  describe('findAll', () => {
    it('should return paginated stores', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockStore] as Store[], 1]),
      };
      (storeRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findAll({ page: 1, size: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status and keyword', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockStore] as Store[], 1]),
      };
      (storeRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.findAll({ status: 'active', keyword: 'Test' });

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should return empty items when no stores', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      (storeRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findAll({ page: 1, size: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return store by id', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(mockStore as Store);

      const result = await service.findById(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw when store not found', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should update store fields', async () => {
      (storeRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockStore as Store) // findById
        .mockResolvedValueOnce(null); // duplicate name check
      (storeRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (storeRepo.findOneByOrFail as jest.Mock).mockResolvedValue({ ...mockStore, name: 'New Name' } as Store);

      const result = await service.update(1, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(storeRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'New Name' }));
    });

    it('should throw when duplicate name', async () => {
      // findById returns store with name 'Original', dto has different name 'DuplicateName'
      const originalStore = { ...mockStore, name: 'Original' };
      (storeRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(originalStore as Store) // findById
        .mockResolvedValueOnce({ ...mockStore, id: 2, name: 'DuplicateName' } as Store); // duplicate

      await expect(service.update(1, { name: 'DuplicateName' })).rejects.toThrow(BusinessException);
    });

    it('should not check duplicate when name not changed', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValueOnce(mockStore as Store); // findById
      (storeRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (storeRepo.findOneByOrFail as jest.Mock).mockResolvedValue(mockStore as Store);

      const result = await service.update(1, { address: 'New Address' });

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft-delete store and reassign staff', async () => {
      const affectedStaff = [{ id: 1 }] as Staff[];
      (storeRepo.findOne as jest.Mock).mockResolvedValue(mockStore as Store);
      (staffRepo.find as jest.Mock).mockResolvedValue(affectedStaff);

      const mockTransaction = jest.fn(async (cb: (manager: Record<string, jest.Mock>) => Promise<void>) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue({ staff_id: 1, store_id: 2 }), // remaining store
          update: jest.fn().mockResolvedValue(undefined),
        };
        await cb(mockManager);
      });
      (storeRepo as unknown as { manager: { transaction: jest.Mock } }).manager.transaction = mockTransaction;

      await service.delete(1);

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw when store not found', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(BusinessException);
    });
  });
});
