import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { HeatmapService } from './heatmap.service';
import { Quote } from '../quote/entities/quote.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('HeatmapService', () => {
  let service: HeatmapService;
  let quoteRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;

  beforeEach(async () => {
    quoteRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeatmapService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepo },
      ],
    }).compile();

    service = module.get<HeatmapService>(HeatmapService);
  });

  describe('generate', () => {
    it('should generate heatmap data points', async () => {
      const rawData = [
        { store_id: '1', density: '50' },
        { store_id: '2', density: '30' },
        { store_id: '3', density: '20' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generate('2026-01-01', '2026-06-30', 'grid');

      expect(result).toHaveLength(3);
      expect(result[0].density).toBe(50);
      expect(result[1].density).toBe(30);
    });

    it('should throw when date range exceeds 365 days', async () => {
      await expect(
        service.generate('2025-01-01', '2026-07-01', 'grid'),
      ).rejects.toThrow(BusinessException);
    });

    it('should return empty array when no data', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generate('2026-01-01', '2026-01-31', 'city');

      expect(result).toHaveLength(0);
    });

    it('should accept exactly 365 days range', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ store_id: '1', density: '10' }]),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generate('2026-01-01', '2027-01-01', 'grid');

      expect(result).toHaveLength(1);
      expect(result[0].density).toBe(10);
    });
  });
});
