import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { Customer } from './entities/customer.entity';
import { Staff } from '../staff/entities/staff.entity';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('CustomerService', () => {
  let service: CustomerService;

  const mockCustomerRepo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const mockStaffRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: mockCustomerRepo },
        { provide: getRepositoryToken(Staff), useValue: mockStaffRepo },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  describe('upsertByPhone', () => {
    it('should upsert customer (INSERT...ON DUPLICATE KEY UPDATE)', async () => {
      const insertBuilder = {
        insert: () => insertBuilder,
        into: () => insertBuilder,
        values: () => insertBuilder,
        orUpdate: () => insertBuilder,
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };
      mockCustomerRepo.createQueryBuilder.mockReturnValue(insertBuilder);
      mockCustomerRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        store_id: 1,
        phone: '13800138000',
        name: 'Test',
        source: 'appointment',
        total_orders: 0,
      } as Customer);

      const result = await service.upsertByPhone(1, '13800138000', { name: 'Test' });

      expect(result).toBeDefined();
      expect(result.phone).toBe('13800138000');
    });
  });

  describe('findAll', () => {
    it('should return paginated customers', async () => {
      mockCustomerRepo.findAndCount.mockResolvedValue([[{ id: 1, name: 'C1' } as Customer], 1]);

      const result = await service.findAll({ page: 1, size: 20, skip: 0, take: 20 });

      expect(result.list).toHaveLength(1);
    });

    it('should filter by keyword', async () => {
      mockCustomerRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, size: 20, skip: 0, take: 20 }, 'Zhang');

      expect(result.list).toHaveLength(0);
      expect(mockCustomerRepo.findAndCount).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return customer by id', async () => {
      mockCustomerRepo.findOne.mockResolvedValue({ id: 1, name: 'Test' } as Customer);

      const result = await service.findById(1);

      expect(result.name).toBe('Test');
    });

    it('should throw when not found', async () => {
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow('Customer not found');
    });
  });

  describe('importCsv', () => {
    it('should import customers from CSV', async () => {
      const csv = 'name,phone\nAlice,13800138000\nBob,13800138001\n';
      const insertBuilder = {
        insert: () => insertBuilder,
        into: () => insertBuilder,
        values: () => insertBuilder,
        orUpdate: () => insertBuilder,
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };
      mockCustomerRepo.createQueryBuilder.mockReturnValue(insertBuilder);
      mockCustomerRepo.findOneOrFail.mockResolvedValue({ id: 1 } as Customer);

      const result = await service.importCsv(1, csv);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should skip invalid rows', async () => {
      const csv = 'name,phone\n,13800138000\nAlice,\n';
      const insertBuilder = {
        insert: () => insertBuilder,
        into: () => insertBuilder,
        values: () => insertBuilder,
        orUpdate: () => insertBuilder,
        execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      };
      mockCustomerRepo.createQueryBuilder.mockReturnValue(insertBuilder);
      mockCustomerRepo.findOneOrFail.mockResolvedValue({ id: 1 } as Customer);

      const result = await service.importCsv(1, csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it('should throw when CSV exceeds 10MB limit', async () => {
      const largeCsv = 'name,phone\n' + 'A,'.repeat(10 * 1024 * 1024);

      await expect(service.importCsv(1, largeCsv)).rejects.toThrow('exceeds 10MB');
    });

    it('should throw when exceeding 5000 rows', async () => {
      let csv = 'name,phone\n';
      for (let i = 0; i < 5001; i++) {
        csv += `Name${i},1380013${String(i).padStart(4, '0')}\n`;
      }

      await expect(service.importCsv(1, csv)).rejects.toThrow('exceeds 5000 rows');
    });
  });
});
