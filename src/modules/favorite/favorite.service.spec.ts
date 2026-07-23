import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FavoriteService } from './favorite.service';
import { Favorite } from './entities/favorite.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('FavoriteService', () => {
  let service: FavoriteService;
  let favoriteRepo: jest.Mocked<
    Pick<Repository<Favorite>, 'findOne' | 'findAndCount' | 'create' | 'save' | 'remove' | 'count'>
  >;
  let configRepo: jest.Mocked<Pick<Repository<Configuration>, 'findOne'>>;

  const mockConfig: Partial<Configuration> = {
    id: 10,
    store_id: 1,
    model_id: 1,
    status: 'confirmed' as const,
    staff_id: 1,
    name: 'test config',
    note: null,
    customer_name: null,
    customer_phone: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockFavorite: Partial<Favorite> = {
    id: 1,
    store_id: 1,
    staff_id: 1,
    configuration_id: 10,
    created_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);
    (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoriteService,
        {
          provide: getRepositoryToken(Favorite),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Configuration),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FavoriteService>(FavoriteService);
    favoriteRepo = module.get(getRepositoryToken(Favorite));
    configRepo = module.get(getRepositoryToken(Configuration));
  });

  describe('add', () => {
    it('should add favorite when configuration exists', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      favoriteRepo.findOne.mockResolvedValue(null); // not already favorited
      favoriteRepo.create.mockReturnValue(mockFavorite as Favorite);
      favoriteRepo.save.mockResolvedValue(mockFavorite as Favorite);

      const result = await service.add(10);

      expect(result).toBeDefined();
      expect(result.configuration_id).toBe(10);
      expect(favoriteRepo.save).toHaveBeenCalled();
    });

    it('should be idempotent — return existing favorite on duplicate', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      favoriteRepo.findOne.mockResolvedValue(mockFavorite as Favorite);

      const result = await service.add(10);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      // save should NOT be called for idempotent return
      expect(favoriteRepo.save).not.toHaveBeenCalled();
    });

    it('should throw when configuration not found', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.add(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('remove', () => {
    it('should remove favorite', async () => {
      favoriteRepo.findOne.mockResolvedValue(mockFavorite as Favorite);
      favoriteRepo.remove.mockResolvedValue(mockFavorite as Favorite);

      await service.remove(10);

      expect(favoriteRepo.remove).toHaveBeenCalledWith(mockFavorite);
    });

    it('should throw when favorite not found', async () => {
      favoriteRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('findAll', () => {
    it('should return paginated favorites with relations', async () => {
      const favorites = [mockFavorite, { ...mockFavorite, id: 2, configuration_id: 20 }];
      favoriteRepo.findAndCount.mockResolvedValue([favorites as Favorite[], 2]);

      const result = await service.findAll({ page: 1, size: 20 } as Parameters<FavoriteService['findAll']>[0]);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.size).toBe(20);
      expect(favoriteRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staff_id: 1 },
          relations: expect.arrayContaining(['configuration']),
        }),
      );
    });

    it('should return empty list when no favorites', async () => {
      favoriteRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, size: 20 } as Parameters<FavoriteService['findAll']>[0]);

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('isFavorited', () => {
    it('should return true when favorited', async () => {
      favoriteRepo.count.mockResolvedValue(1);

      const result = await service.isFavorited(10);

      expect(result).toBe(true);
    });

    it('should return false when not favorited', async () => {
      favoriteRepo.count.mockResolvedValue(0);

      const result = await service.isFavorited(10);

      expect(result).toBe(false);
    });
  });
});
