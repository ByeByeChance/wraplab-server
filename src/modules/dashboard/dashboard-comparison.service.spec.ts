import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardComparisonService } from './dashboard-comparison.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';

describe('DashboardComparisonService', () => {
  let service: DashboardComparisonService;
  let quoteRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let appointmentRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let customerRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;

  beforeEach(async () => {
    quoteRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    appointmentRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    customerRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardComparisonService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
      ],
    }).compile();

    service = module.get<DashboardComparisonService>(DashboardComparisonService);
  });

  const setupRawOneResponse = (revenue: string, quoteCount: string, convRate: string, aov: string) => ({
    revenue,
    quote_count: quoteCount,
    conversion_rate: convRate,
    average_order_value: aov,
  });

  describe('compare', () => {
    it('should compare monthly mom metrics', async () => {
      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce(setupRawOneResponse('50000', '20', '40', '2500')) // current
          .mockResolvedValueOnce(setupRawOneResponse('40000', '18', '35', '2200')), // previous
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce({ appointment_count: '8' })
          .mockResolvedValueOnce({ appointment_count: '6' }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce({ new_customer_count: '5' })
          .mockResolvedValueOnce({ new_customer_count: '4' }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.compare(1, 'mom', 'monthly');

      expect(result.revenue.current).toBe(50000);
      expect(result.revenue.previous).toBe(40000);
      expect(result.revenue.growth_pct).toBe(25);
      expect(result.quote_count.current).toBe(20);
      expect(result.appointment_count.current).toBe(8);
      expect(result.new_customer_count.current).toBe(5);
      expect(result.period_label).toBeDefined();
    });

    it('should compare quarterly yoy metrics', async () => {
      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce(setupRawOneResponse('100000', '50', '50', '2000'))
          .mockResolvedValueOnce(setupRawOneResponse('90000', '45', '48', '2000')),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce({ appointment_count: '20' })
          .mockResolvedValueOnce({ appointment_count: '18' }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce({ new_customer_count: '12' })
          .mockResolvedValueOnce({ new_customer_count: '10' }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.compare(1, 'yoy', 'quarterly');

      expect(result.revenue.growth_pct).toBeGreaterThan(0);
      expect(result.period_label).toContain('vs');
    });

    it('should return null growth when previous period has zero', async () => {
      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce(setupRawOneResponse('5000', '5', '20', '1000'))
          .mockResolvedValueOnce(setupRawOneResponse('0', '0', '0', '0')),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ appointment_count: '2' }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ new_customer_count: '1' }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.compare(1, 'mom', 'monthly');

      expect(result.revenue.growth_pct).toBeNull();
    });

    it('should handle zero values gracefully', async () => {
      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn()
          .mockResolvedValueOnce(setupRawOneResponse('0', '0', '0', '0'))
          .mockResolvedValueOnce(setupRawOneResponse('0', '0', '0', '0')),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ appointment_count: '0' }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ new_customer_count: '0' }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.compare(1, 'mom', 'monthly');

      expect(result.revenue.current).toBe(0);
      expect(result.revenue.previous).toBe(0);
    });
  });
});
