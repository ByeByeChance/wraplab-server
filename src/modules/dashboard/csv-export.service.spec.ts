import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CsvExportService } from './csv-export.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('CsvExportService', () => {
  let service: CsvExportService;
  let quoteRepo: jest.Mocked<Pick<Repository<Quote>, 'count' | 'find'>>;
  let appointmentRepo: jest.Mocked<Pick<Repository<Appointment>, 'count' | 'find'>>;
  let customerRepo: jest.Mocked<Pick<Repository<Customer>, 'count' | 'find'>>;

  const mockQuote: Partial<Quote> = {
    id: 1,
    store_id: 1,
    configuration_id: 1,
    total_price: 10000,
    final_price: 8000,
    status: 'closed',
    staff_id: 1,
    created_at: new Date('2026-07-01'),
    updated_at: new Date(),
    deleted_at: null,
  } as Partial<Quote>;

  const mockAppointment: Partial<Appointment> = {
    id: 1,
    store_id: 1,
    customer_id: null,
    customer_name: 'Test Customer',
    customer_phone: '13800138000',
    service_type: 'full_wrap',
    appointment_date: '2026-07-01',
    time_slot: 'MORNING',
    status: 'confirmed',
    created_at: new Date('2026-07-01'),
    updated_at: new Date(),
  };

  const mockCustomer: Partial<Customer> = {
    id: 1,
    store_id: 1,
    name: 'Test Customer',
    phone: '13800138000',
    source: 'quote',
    total_orders: 3,
    created_at: new Date('2026-07-01'),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvExportService,
        {
          provide: getRepositoryToken(Quote),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CsvExportService>(CsvExportService);
    quoteRepo = module.get(getRepositoryToken(Quote));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    customerRepo = module.get(getRepositoryToken(Customer));
  });

  describe('estimateRowCount', () => {
    it('should estimate row count for quotes', async () => {
      (quoteRepo.count as jest.Mock).mockResolvedValue(50);

      const result = await service.estimateRowCount('quotes', '2026-07-01', '2026-07-31', 1);

      expect(result).toBe(50);
      expect(quoteRepo.count).toHaveBeenCalled();
    });

    it('should estimate row count for appointments', async () => {
      (appointmentRepo.count as jest.Mock).mockResolvedValue(20);

      const result = await service.estimateRowCount('appointments', '2026-07-01', '2026-07-31', 1);

      expect(result).toBe(20);
    });

    it('should estimate row count for customers', async () => {
      (customerRepo.count as jest.Mock).mockResolvedValue(30);

      const result = await service.estimateRowCount('customers', '2026-07-01', '2026-07-31', 1);

      expect(result).toBe(30);
    });

    it('should return 0 for unknown data type', async () => {
      const result = await service.estimateRowCount('unknown', '2026-07-01', '2026-07-31', 1);

      expect(result).toBe(0);
    });
  });

  describe('validateExport', () => {
    it('should pass validation when row count within limit', async () => {
      (quoteRepo.count as jest.Mock).mockResolvedValue(100);

      await expect(
        service.validateExport({ data_type: 'quotes', date_from: '2026-07-01', date_to: '2026-07-31' }, 1),
      ).resolves.toBeUndefined();
    });

    it('should throw when row count exceeds limit', async () => {
      (quoteRepo.count as jest.Mock).mockResolvedValue(20000);

      await expect(
        service.validateExport({ data_type: 'quotes', date_from: '2026-01-01', date_to: '2026-12-31' }, 1),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('generateCsv', () => {
    it('should generate CSV for quotes', async () => {
      (quoteRepo.find as jest.Mock).mockResolvedValue([mockQuote] as Quote[]);

      const result = await service.generateCsv(
        { data_type: 'quotes', date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      expect(result).toContain('报价单号');
      expect(result).toContain('原价');
      expect(result).toContain('成交价');
      expect(result).toContain('closed');
      // Should have BOM for Excel compatibility
      expect(result.charCodeAt(0)).toBe(0xfeff);
    });

    it('should generate CSV for appointments', async () => {
      (appointmentRepo.find as jest.Mock).mockResolvedValue([mockAppointment] as Appointment[]);

      const result = await service.generateCsv(
        { data_type: 'appointments', date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      expect(result).toContain('预约号');
      expect(result).toContain('Test Customer');
      expect(result).toContain('MORNING');
    });

    it('should generate CSV for customers', async () => {
      (customerRepo.find as jest.Mock).mockResolvedValue([mockCustomer] as Customer[]);

      const result = await service.generateCsv(
        { data_type: 'customers', date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      expect(result).toContain('姓名');
      expect(result).toContain('Test Customer');
      expect(result).toContain('13800138000');
    });

    it('should escape CSV fields with commas', async () => {
      const apptWithComma: Partial<Appointment> = {
        ...mockAppointment,
        customer_name: 'Name, With Comma',
      };
      (appointmentRepo.find as jest.Mock).mockResolvedValue([apptWithComma] as Appointment[]);

      const result = await service.generateCsv(
        { data_type: 'appointments', date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      expect(result).toContain('"Name, With Comma"');
    });

    it('should return empty CSV for unknown data type', async () => {
      const result = await service.generateCsv(
        { data_type: 'unknown' as string, date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      // BOM only, no header row when no data
      expect(result).toBe('﻿');
    });

    it('should handle null fields in data gracefully', async () => {
      const quoteWithNulls = {
        ...mockQuote,
        total_price: 0,
        final_price: null as unknown as number,
        created_at: undefined as unknown as Date,
      } as Partial<Quote>;
      (quoteRepo.find as jest.Mock).mockResolvedValue([quoteWithNulls] as Quote[]);

      const result = await service.generateCsv(
        { data_type: 'quotes', date_from: '2026-07-01', date_to: '2026-07-31' },
        1,
      );

      expect(result).toContain('0');
    });
  });
});
