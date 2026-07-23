import { Test, TestingModule } from '@nestjs/testing';
import { StoreComparisonService } from './store-comparison.service';
import { StoreDashboardService } from './store-dashboard.service';
import { StoreDashboardDto } from '../admin/dto/store-dashboard.dto';

describe('StoreComparisonService', () => {
  let service: StoreComparisonService;
  let storeDashboardService: jest.Mocked<Pick<StoreDashboardService, 'getSingleStore'>>;

  const createMockDashboard = (overrides: Partial<StoreDashboardDto> = {}): StoreDashboardDto => ({
    total_revenue: 50000,
    quote_count: 10,
    conversion_rate: 40,
    appointment_count: 5,
    arrival_rate: 80,
    new_customer_count: 3,
    average_order_value: 5000,
    top_staff: [{ staff_id: 1, name: 'Staff 1', revenue: 30000 }],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreComparisonService,
        {
          provide: StoreDashboardService,
          useValue: {
            getSingleStore: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StoreComparisonService>(StoreComparisonService);
    storeDashboardService = module.get(StoreDashboardService);
  });

  describe('compare', () => {
    it('should compare multiple stores', async () => {
      (storeDashboardService.getSingleStore as jest.Mock)
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 60000, quote_count: 12 }))
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 40000, quote_count: 8 }));

      const result = await service.compare([1, 2], 'daily');

      expect(result.items).toHaveLength(2);
      expect(result.platform_average.revenue_avg).toBeGreaterThan(0);
      expect(result.platform_average.conversion_rate_avg).toBe(40);
      expect(storeDashboardService.getSingleStore).toHaveBeenCalledTimes(2);
    });

    it('should return zero averages when all stores have no data', async () => {
      (storeDashboardService.getSingleStore as jest.Mock)
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 0, quote_count: 0, appointment_count: 0 }))
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 0, quote_count: 0, appointment_count: 0 }));

      const result = await service.compare([1, 2], 'daily');

      expect(result.items).toHaveLength(2);
      expect(result.platform_average.revenue_avg).toBe(0);
      expect(result.platform_average.conversion_rate_avg).toBe(0);
      expect(result.platform_average.arrival_rate_avg).toBe(0);
    });

    it('should calculate averages only for stores with data', async () => {
      (storeDashboardService.getSingleStore as jest.Mock)
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 50000, quote_count: 10 }))
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 0, quote_count: 0, appointment_count: 0 }));

      const result = await service.compare([1, 2], 'daily');

      expect(result.items).toHaveLength(2);
      expect(result.platform_average.revenue_avg).toBe(50000);
    });

    it('should handle single store comparison', async () => {
      (storeDashboardService.getSingleStore as jest.Mock)
        .mockResolvedValueOnce(createMockDashboard({ total_revenue: 30000, quote_count: 5 }));

      const result = await service.compare([1], 'weekly');

      expect(result.items).toHaveLength(1);
      expect(result.platform_average.revenue_avg).toBe(30000);
    });
  });
});
