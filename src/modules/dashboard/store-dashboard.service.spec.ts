import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StoreDashboardService } from './store-dashboard.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('StoreDashboardService', () => {
  let service: StoreDashboardService;
  let quoteRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let appointmentRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let customerRepo: jest.Mocked<{ createQueryBuilder: jest.Mock }>;
  let storeRepo: jest.Mocked<Pick<Repository<Store>, 'findOne'>>;

  const mockStore: Partial<Store> = {
    id: 1,
    name: 'Test Store',
    address: '123 Test St',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    quoteRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    appointmentRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;
    customerRepo = { createQueryBuilder: jest.fn() } as jest.Mocked<{ createQueryBuilder: jest.Mock }>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreDashboardService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        {
          provide: getRepositoryToken(Store),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StoreDashboardService>(StoreDashboardService);
    storeRepo = module.get(getRepositoryToken(Store));
  });

  describe('getSingleStore', () => {
    it('should return store dashboard data for daily period', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(mockStore as Store);

      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total_revenue: '50000',
          quote_count: '10',
          conversion_rate: '30',
          average_order_value: '5000',
        }),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ staff_id: '1', revenue: '30000' }]),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ appointment_count: '5', arrival_rate: '80' }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ new_customer_count: '3' }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.getSingleStore(1, 'daily');

      expect(result.total_revenue).toBe(50000);
      expect(result.quote_count).toBe(10);
      expect(result.conversion_rate).toBe(30);
      expect(result.new_customer_count).toBe(3);
      expect(result.top_staff).toHaveLength(1);
    });

    it('should throw when store not found', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getSingleStore(999, 'daily')).rejects.toThrow(BusinessException);
    });

    it('should return zeros when no data exists', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(mockStore as Store);

      const quoteBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total_revenue: null, quote_count: null, conversion_rate: null, average_order_value: null }),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      quoteRepo.createQueryBuilder.mockReturnValue(quoteBuilder);

      const apptBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ appointment_count: null, arrival_rate: null }),
      };
      appointmentRepo.createQueryBuilder.mockReturnValue(apptBuilder);

      const customerBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ new_customer_count: null }),
      };
      customerRepo.createQueryBuilder.mockReturnValue(customerBuilder);

      const result = await service.getSingleStore(1, 'daily');

      expect(result.total_revenue).toBe(0);
      expect(result.quote_count).toBe(0);
      expect(result.top_staff).toHaveLength(0);
    });
  });
});
