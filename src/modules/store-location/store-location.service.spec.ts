import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StoreLocationService } from './store-location.service';
import { StoreLocation } from './entities/store-location.entity';
import { Store } from '../store/entities/store.entity';

describe('StoreLocationService', () => {
  let service: StoreLocationService;

  const mockLocationRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockStoreRepo = {
    findBy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreLocationService,
        { provide: getRepositoryToken(StoreLocation), useValue: mockLocationRepo },
        { provide: getRepositoryToken(Store), useValue: mockStoreRepo },
      ],
    }).compile();

    service = module.get<StoreLocationService>(StoreLocationService);
  });

  describe('findNearby', () => {
    it('should return nearby stores sorted by distance', async () => {
      mockLocationRepo.find.mockResolvedValue([
        {
          id: 1,
          store_id: 1,
          lat: 31.2304,
          lng: 121.4737,
          address: 'Shanghai Store',
          province: 'Shanghai',
          city: 'Shanghai',
          district: 'Huangpu',
        },
        {
          id: 2,
          store_id: 2,
          lat: 31.2354,
          lng: 121.4837,
          address: 'Far Store',
          province: 'Shanghai',
          city: 'Shanghai',
          district: 'Jingan',
        },
      ] as StoreLocation[]);

      mockStoreRepo.findBy.mockResolvedValue([
        { id: 1, name: 'Near Store', status: 'active' },
        { id: 2, name: 'Far Store', status: 'active' },
      ] as Store[]);

      const results = await service.findNearby(31.2304, 121.4737, 5000);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].store_name).toBe('Near Store');
      // Near store should come first
      if (results.length > 1) {
        expect(results[0].distance).toBeLessThanOrEqual(results[1].distance);
      }
    });

    it('should filter inactive stores', async () => {
      mockLocationRepo.find.mockResolvedValue([
        { id: 1, store_id: 1, lat: 31.2304, lng: 121.4737, address: 'Store' },
      ] as StoreLocation[]);

      mockStoreRepo.findBy.mockResolvedValue([{ id: 1, name: 'Inactive Store', status: 'inactive' }] as Store[]);

      const results = await service.findNearby(31.2304, 121.4737, 5000);

      expect(results.length).toBe(0);
    });

    it('should return empty array for no results', async () => {
      mockLocationRepo.find.mockResolvedValue([]);

      const results = await service.findNearby(31.2304, 121.4737, 5000);

      expect(results).toEqual([]);
    });

    it('should filter locations beyond radius using Haversine', async () => {
      // Center: Shanghai (31.2304, 121.4737)
      // Far point: Beijing (39.9042, 116.4074) — ~1000km away
      mockLocationRepo.find.mockResolvedValue([
        { id: 1, store_id: 1, lat: 39.9042, lng: 116.4074, address: 'Beijing Store' },
      ] as StoreLocation[]);

      mockStoreRepo.findBy.mockResolvedValue([{ id: 1, name: 'Beijing Store', status: 'active' }] as Store[]);

      const results = await service.findNearby(31.2304, 121.4737, 5000);

      // Beijing should be filtered out by Haversine check (> 5km)
      expect(results.length).toBe(0);
    });
  });

  describe('findByStoreId', () => {
    it('should return location for a given store id', async () => {
      const location = { id: 1, store_id: 1 } as StoreLocation;
      mockLocationRepo.findOne.mockResolvedValue(location);

      const result = await service.findByStoreId(1);

      expect(result).toBe(location);
      expect(mockLocationRepo.findOne).toHaveBeenCalledWith({ where: { store_id: 1 } });
    });

    it('should return null when no location found', async () => {
      mockLocationRepo.findOne.mockResolvedValue(null);

      const result = await service.findByStoreId(999);

      expect(result).toBeNull();
    });
  });
});
