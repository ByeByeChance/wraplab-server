import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TimeSlotCapacityService } from './time-slot-capacity.service';
import { ServiceTypeConfig } from './entities/service-type-config.entity';
import { StoreServiceConfig } from './entities/store-service-config.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('TimeSlotCapacityService', () => {
  let service: TimeSlotCapacityService;
  let serviceTypeConfigRepo: jest.Mocked<Pick<Repository<ServiceTypeConfig>, 'findOne' | 'find'>>;
  let storeServiceConfigRepo: jest.Mocked<Pick<Repository<StoreServiceConfig>, 'findOne' | 'find' | 'manager'>>;

  const mockGlobalConfig: Partial<ServiceTypeConfig> = {
    id: 1,
    service_type: 'full_wrap',
    duration_minutes: 120,
    label: '全车贴膜',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockStoreConfig: Partial<StoreServiceConfig> = {
    id: 1,
    store_id: 1,
    service_type: 'full_wrap',
    duration_minutes: 90,
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
        TimeSlotCapacityService,
        {
          provide: getRepositoryToken(ServiceTypeConfig),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StoreServiceConfig),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            manager: mockManager,
          },
        },
      ],
    }).compile();

    service = module.get<TimeSlotCapacityService>(TimeSlotCapacityService);
    serviceTypeConfigRepo = module.get(getRepositoryToken(ServiceTypeConfig));
    storeServiceConfigRepo = module.get(getRepositoryToken(StoreServiceConfig));
  });

  describe('getCapacity', () => {
    it('should use store custom config when available', async () => {
      (storeServiceConfigRepo.findOne as jest.Mock).mockResolvedValue(mockStoreConfig as StoreServiceConfig);

      const result = await service.getCapacity(540, 'full_wrap', 1);

      // 540 min slot / 30 min unit = 18 slot units. 90 min service / 30 = 3 slots needed. 18/3 = 6 capacity
      expect(result.capacity).toBe(6);
      expect(result.booked).toBe(0);
      expect(result.available).toBe(6);
    });

    it('should fallback to global config when no store config', async () => {
      (storeServiceConfigRepo.findOne as jest.Mock).mockResolvedValue(null);
      (serviceTypeConfigRepo.findOne as jest.Mock).mockResolvedValue(mockGlobalConfig as ServiceTypeConfig);

      const result = await service.getCapacity(540, 'full_wrap', 2);

      // 120 min service / 30 = 4 slots. 18/4 = 4 capacity
      expect(result.capacity).toBe(4);
    });

    it('should throw when service type not configured anywhere', async () => {
      (storeServiceConfigRepo.findOne as jest.Mock).mockResolvedValue(null);
      (serviceTypeConfigRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getCapacity(540, 'unknown_service', 1)).rejects.toThrow(BusinessException);
    });

    it('should calculate capacity for short duration services', async () => {
      const shortConfig = { ...mockGlobalConfig, duration_minutes: 30 };
      (storeServiceConfigRepo.findOne as jest.Mock).mockResolvedValue(null);
      (serviceTypeConfigRepo.findOne as jest.Mock).mockResolvedValue(shortConfig as ServiceTypeConfig);

      const result = await service.getCapacity(540, 'detail_treatment', 1);

      // 30 min service / 30 = 1 slot. 18/1 = 18 capacity
      expect(result.capacity).toBe(18);
    });
  });

  describe('getStoreServiceConfig', () => {
    it('should merge global and store custom configs', async () => {
      const globalConfigs = [
        { ...mockGlobalConfig, id: 1, service_type: 'full_wrap', duration_minutes: 120, label: '全车贴膜' },
        { ...mockGlobalConfig, id: 2, service_type: 'partial_wrap', duration_minutes: 60, label: '局部贴膜' },
      ];
      const storeConfigs = [mockStoreConfig];

      (serviceTypeConfigRepo.find as jest.Mock).mockResolvedValue(globalConfigs as ServiceTypeConfig[]);
      (storeServiceConfigRepo.find as jest.Mock).mockResolvedValue(storeConfigs as StoreServiceConfig[]);

      const result = await service.getStoreServiceConfig(1);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('custom');
      expect(result[0].duration_minutes).toBe(90);
      expect(result[1].source).toBe('global');
      expect(result[1].duration_minutes).toBe(60);
    });

    it('should return all as global when no store configs', async () => {
      const globalConfigs = [{ ...mockGlobalConfig }];
      (serviceTypeConfigRepo.find as jest.Mock).mockResolvedValue(globalConfigs as ServiceTypeConfig[]);
      (storeServiceConfigRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getStoreServiceConfig(1);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('global');
    });

    it('should return empty when no global configs', async () => {
      (serviceTypeConfigRepo.find as jest.Mock).mockResolvedValue([]);
      (storeServiceConfigRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getStoreServiceConfig(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('updateStoreServiceConfig', () => {
    it('should upsert store service configs within transaction', async () => {
      (storeServiceConfigRepo.findOne as jest.Mock).mockResolvedValue(null); // will use transaction manager

      const mockTransaction = jest.fn(async (cb: (manager: Record<string, jest.Mock>) => Promise<void>) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(null), // no existing config
          update: jest.fn(),
          save: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockReturnValue({}),
        };
        await cb(mockManager);
      });
      (storeServiceConfigRepo as unknown as { manager: { transaction: jest.Mock } }).manager.transaction = mockTransaction;

      await service.updateStoreServiceConfig(1, {
        services: [
          { service_type: 'full_wrap', duration_minutes: 60 },
          { service_type: 'partial_wrap', duration_minutes: 30 },
        ],
      });

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should update existing configs in transaction', async () => {
      const mockTransaction = jest.fn(async (cb: (manager: Record<string, jest.Mock>) => Promise<void>) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue({ id: 1, service_type: 'full_wrap' }),
          update: jest.fn().mockResolvedValue(undefined),
          save: jest.fn(),
          create: jest.fn(),
        };
        await cb(mockManager);
      });
      (storeServiceConfigRepo as unknown as { manager: { transaction: jest.Mock } }).manager.transaction = mockTransaction;

      await service.updateStoreServiceConfig(1, {
        services: [{ service_type: 'full_wrap', duration_minutes: 45 }],
      });

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
