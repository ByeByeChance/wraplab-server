import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigurationService } from './configuration.service';
import { Configuration } from './entities/configuration.entity';
import { PartColor } from './entities/part-color.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';
import { Material } from '../color/entities/material.entity';
import { StoreContext } from '../../common/context/store-context';

// Mock StoreContext
jest.mock('../../common/context/store-context');

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  const mockConfigRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const mockPartColorRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const mockModelRepo = {
    findOne: jest.fn(),
  };
  const mockSwatchRepo = {
    findOne: jest.fn(),
  };
  const mockMaterialRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);
    (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationService,
        { provide: getRepositoryToken(Configuration), useValue: mockConfigRepo },
        { provide: getRepositoryToken(PartColor), useValue: mockPartColorRepo },
        { provide: getRepositoryToken(CarModel), useValue: mockModelRepo },
        { provide: getRepositoryToken(ColorSwatch), useValue: mockSwatchRepo },
        { provide: getRepositoryToken(Material), useValue: mockMaterialRepo },
      ],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
  });

  describe('create', () => {
    it('should create configuration with FULL part_color', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 1 } as CarModel);
      mockSwatchRepo.findOne.mockResolvedValue({ id: 2 } as ColorSwatch);
      mockMaterialRepo.findOne.mockResolvedValue({ id: 3, price_multiplier: 1.0 } as Material);

      const savedConfig = {
        id: 10,
        store_id: 1,
        model_id: 1,
        status: 'draft',
        staff_id: 1,
        name: 'test',
        note: null,
        customer_name: null,
        customer_phone: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      mockConfigRepo.create.mockReturnValue(savedConfig);
      mockConfigRepo.save.mockResolvedValue(savedConfig);

      mockPartColorRepo.create.mockReturnValue({});
      mockPartColorRepo.save.mockResolvedValue({});

      // Mock findById
      mockConfigRepo.findOne.mockResolvedValue({
        ...savedConfig,
        model: { id: 1, name: 'Test', series: null },
        partColors: [],
      });

      const result = await service.create({
        model_id: 1,
        color_swatch_id: 2,
        material_id: 3,
      });

      expect(result).toBeDefined();
      expect(mockConfigRepo.save).toHaveBeenCalled();
      expect(mockPartColorRepo.save).toHaveBeenCalled();
    });

    it('should throw when model does not exist', async () => {
      mockModelRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ model_id: 999, color_swatch_id: 1, material_id: 1 })).rejects.toThrow('车型不存在');
    });
  });

  describe('findAll', () => {
    it('should return paginated results filtered by store_id', async () => {
      const configs = [
        { id: 1, store_id: 1, status: 'draft' },
        { id: 2, store_id: 1, status: 'quoted' },
      ];
      mockConfigRepo.findAndCount.mockResolvedValue([configs, 2]);

      const result = await service.findAll({ page: 1, size: 10, skip: 0, take: 10 });

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockConfigRepo.findAndCount).toHaveBeenCalled();
    });
  });
});
