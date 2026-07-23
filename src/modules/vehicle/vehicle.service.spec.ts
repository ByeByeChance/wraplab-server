import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VehicleService } from './vehicle.service';
import { CarBrand } from './entities/car-brand.entity';
import { CarSeries } from './entities/car-series.entity';
import { CarModel } from './entities/car-model.entity';
import { CarPart } from './entities/car-part.entity';
import { RedisService } from '../redis/redis.service';

describe('VehicleService', () => {
  let service: VehicleService;

  const mockBrandRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mockSeriesRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mockModelRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mockCarPartRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleService,
        { provide: getRepositoryToken(CarBrand), useValue: mockBrandRepo },
        { provide: getRepositoryToken(CarSeries), useValue: mockSeriesRepo },
        { provide: getRepositoryToken(CarModel), useValue: mockModelRepo },
        { provide: getRepositoryToken(CarPart), useValue: mockCarPartRepo },
        {
          provide: RedisService,
          useValue: { getClient: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() }) },
        },
      ],
    }).compile();

    service = module.get<VehicleService>(VehicleService);
  });

  it('should return brands sorted by sort_order DESC', async () => {
    const brands = [
      { id: 1, name: 'BMW', sort_order: 5 } as CarBrand,
      { id: 2, name: 'Benz', sort_order: 3 } as CarBrand,
    ];
    mockBrandRepo.find.mockResolvedValue(brands);

    const result = await service.getBrands();
    expect(mockBrandRepo.find).toHaveBeenCalled();
    expect(result).toEqual(brands);
  });

  it('should return series filtered by brandId', async () => {
    const series = [{ id: 1, name: '3系', brand_id: 1 } as CarSeries];
    mockSeriesRepo.find.mockResolvedValue(series);

    const result = await service.getSeries(1);
    expect(result).toEqual(series);
  });

  it('should return empty array when no data exists', async () => {
    mockBrandRepo.find.mockResolvedValue([]);
    const result = await service.getBrands();
    expect(result).toEqual([]);
  });

  it('should return model with relations for getModelById', async () => {
    const model = { id: 1, name: '325Li', model_3d_url: null } as CarModel;
    mockModelRepo.findOne.mockResolvedValue(model);

    const result = await service.getModelById(1);
    expect(result).toEqual(model);
    expect(mockModelRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, deleted_at: expect.anything() },
      relations: ['series', 'series.brand'],
    });
  });

  describe('part area', () => {
    const mockPart = { id: 1, model_id: 1, part_code: 'HOOD', area_m2: 1.5 };

    it('should get part areas by model id', async () => {
      mockCarPartRepo.find.mockResolvedValue([mockPart]);

      const result = await service.getPartAreas(1);
      expect(result).toHaveLength(1);
      expect(result[0].part_code).toBe('HOOD');
    });

    it('should return empty array when no parts exist', async () => {
      mockCarPartRepo.find.mockResolvedValue([]);

      const result = await service.getPartAreas(1);
      expect(result).toEqual([]);
    });

    it('should batch update part areas (upsert)', async () => {
      mockCarPartRepo.findOne.mockResolvedValue(mockPart);
      mockCarPartRepo.save.mockResolvedValue({ ...mockPart, area_m2: 2.0 });

      const result = await service.batchUpdatePartAreas(1, [{ part_code: 'HOOD', area_m2: 2.0 }]);

      expect(result).toHaveLength(1);
      expect(mockCarPartRepo.save).toHaveBeenCalled();
    });

    it('should batch create new parts', async () => {
      mockCarPartRepo.findOne.mockResolvedValue(null);
      mockCarPartRepo.create.mockReturnValue(mockPart);
      mockCarPartRepo.save.mockResolvedValue(mockPart);

      const result = await service.batchUpdatePartAreas(1, [{ part_code: 'HOOD', area_m2: 1.5 }]);

      expect(result).toHaveLength(1);
      expect(mockCarPartRepo.create).toHaveBeenCalled();
    });

    it('should copy part areas from template model', async () => {
      mockCarPartRepo.find.mockResolvedValue([mockPart]);
      mockCarPartRepo.findOne.mockResolvedValue(null);
      mockCarPartRepo.create.mockReturnValue(mockPart);
      mockCarPartRepo.save.mockResolvedValue(mockPart);

      const result = await service.copyPartAreas(2, 1);

      expect(result).toHaveLength(1);
      expect(mockCarPartRepo.find).toHaveBeenCalledWith({
        where: { model_id: 1 },
      });
    });

    it('should return empty array when template has no parts', async () => {
      mockCarPartRepo.find.mockResolvedValue([]);

      const result = await service.copyPartAreas(2, 1);

      expect(result).toEqual([]);
    });

    it('should get part area summary with total', async () => {
      mockCarPartRepo.find.mockResolvedValue([
        { part_code: 'HOOD', area_m2: 1.5 },
        { part_code: 'ROOF', area_m2: 2.0 },
      ]);

      const result = await service.getPartAreaSummary(1);

      expect(result.total_area_m2).toBe(3.5);
      expect(result.parts).toHaveLength(2);
    });
  });
});
