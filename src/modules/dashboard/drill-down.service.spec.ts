import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DrillDownService } from './drill-down.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';

describe('DrillDownService', () => {
  let service: DrillDownService;
  let quoteRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let appointmentRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let customerRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;

  beforeEach(async () => {
    quoteRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    appointmentRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    customerRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrillDownService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
      ],
    }).compile();

    service = module.get<DrillDownService>(DrillDownService);
  });

  describe('getDetails', () => {
    it('should drill down revenue by staff', async () => {
      const rawData = [
        { dimension_value: '1', metric_value: '50000' },
        { dimension_value: '2', metric_value: '30000' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      // clone() returns the same builder for count
      qb.clone.mockReturnValue(qb);
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDetails(1, 'revenue', 'monthly', undefined, 'staff', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].dimension_value).toContain('员工');
      expect(result.items[0].metric_value).toBe(50000);
      expect(result.items[0].percentage).toBeDefined();
    });

    it('should drill down quotes by brand', async () => {
      const rawData = [
        { dimension_value: 'BMW', metric_value: '15' },
        { dimension_value: 'Audi', metric_value: '8' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDetails(1, 'quotes', 'weekly', undefined, 'brand', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].dimension_value).toBe('BMW');
    });

    it('should drill down appointments by day', async () => {
      const rawData = [
        { dimension_value: '2026-07-01', metric_value: '3' },
        { dimension_value: '2026-07-02', metric_value: '5' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDetails(1, 'appointments', 'weekly', undefined, 'day', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].dimension_value).toBe('2026-07-01');
    });

    it('should drill down customers by service_type', async () => {
      const rawData = [
        { dimension_value: 'full_wrap', metric_value: '10' },
        { dimension_value: '无服务记录', metric_value: '3' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawData),
      };
      customerRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDetails(1, 'customers', 'monthly', undefined, 'service_type', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].dimension_value).toBe('full_wrap');
    });

    it('should return empty items when groupBy does not match metricType', async () => {
      const result = await service.getDetails(1, 'revenue', 'monthly', undefined, 'brand', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle empty results', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      qb.clone.mockReturnValue(qb);
      quoteRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDetails(1, 'revenue', 'monthly', undefined, 'staff', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
