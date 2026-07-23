import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { CampaignClaim } from '../campaign/entities/campaign-claim.entity';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockQuoteRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockAppointmentRepo = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };
  const mockClaimRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Quote), useValue: mockQuoteRepo },
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(CampaignClaim), useValue: mockClaimRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getOverview', () => {
    it('should return today overview stats', async () => {
      const quoteBuilder = {
        select: () => quoteBuilder,
        addSelect: () => quoteBuilder,
        where: () => quoteBuilder,
        andWhere: () => quoteBuilder,
        getRawOne: jest.fn().mockResolvedValue({ revenue: '5000', count: '10' }),
      };
      mockQuoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);
      mockAppointmentRepo.count.mockResolvedValue(5);

      const result = await service.getOverview();

      expect(result.today_revenue).toBe(5000);
      expect(result.today_orders).toBe(10);
      expect(result.today_appointments).toBe(5);
    });

    it('should return zeros for empty data', async () => {
      const quoteBuilder = {
        select: () => quoteBuilder,
        addSelect: () => quoteBuilder,
        where: () => quoteBuilder,
        andWhere: () => quoteBuilder,
        getRawOne: jest.fn().mockResolvedValue({ revenue: null, count: null }),
      };
      mockQuoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);
      mockAppointmentRepo.count.mockResolvedValue(0);

      const result = await service.getOverview();

      expect(result.today_revenue).toBe(0);
      expect(result.today_appointments).toBe(0);
    });
  });

  describe('getTrends', () => {
    it('should return trend data', async () => {
      const quoteBuilder = {
        select: () => quoteBuilder,
        addSelect: () => quoteBuilder,
        where: () => quoteBuilder,
        andWhere: () => quoteBuilder,
        groupBy: () => quoteBuilder,
        orderBy: () => quoteBuilder,
        getRawMany: jest.fn().mockResolvedValue([{ date: '2026-07-01', revenue: '1000', orders: '5' }]),
      };
      const apptBuilder = {
        select: () => apptBuilder,
        addSelect: () => apptBuilder,
        where: () => apptBuilder,
        andWhere: () => apptBuilder,
        groupBy: () => apptBuilder,
        orderBy: () => apptBuilder,
        getRawMany: jest.fn().mockResolvedValue([{ date: '2026-07-01', appointments: '3' }]),
      };
      mockQuoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);
      mockAppointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const result = await service.getTrends('2026-07-01', '2026-07-02', 'day');

      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(1000);
      expect(result[0].appointments).toBe(3);
    });

    it('should throw when date range exceeds 90 days', async () => {
      await expect(service.getTrends('2026-01-01', '2026-07-01', 'day')).rejects.toThrow(
        'Date range cannot exceed 90 days',
      );
    });
  });

  describe('getTopStores', () => {
    it('should return top stores by revenue', async () => {
      const builder = {
        select: () => builder,
        addSelect: () => builder,
        where: () => builder,
        groupBy: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        getRawMany: jest.fn().mockResolvedValue([{ store_id: '1', revenue: '10000', order_count: '20' }]),
      };
      mockQuoteRepo.createQueryBuilder.mockReturnValue(builder);

      const result = await service.getTopStores(10);

      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(10000);
    });
  });

  describe('getTopCampaigns', () => {
    it('should return top campaigns by usage', async () => {
      const builder = {
        select: () => builder,
        addSelect: () => builder,
        groupBy: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        getRawMany: jest.fn().mockResolvedValue([{ campaign_id: '1', usage_count: '50', total_discount: '5000' }]),
      };
      mockClaimRepo.createQueryBuilder.mockReturnValue(builder);

      const result = await service.getTopCampaigns(10);

      expect(result).toHaveLength(1);
      expect(result[0].usage_count).toBe(50);
    });
  });
});
