import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ScheduledExportService } from './scheduled-export.service';
import { ScheduledExport } from './entities/scheduled-export.entity';
import { ScheduledExportLog } from './entities/scheduled-export-log.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('ScheduledExportService', () => {
  let service: ScheduledExportService;
  let scheduleRepo: jest.Mocked<
    Pick<Repository<ScheduledExport>, 'findOne' | 'find' | 'create' | 'save' | 'update' | 'findOneByOrFail'>
  >;
  let logRepo: jest.Mocked<Pick<Repository<ScheduledExportLog>, 'find' | 'create' | 'save'>>;

  const mockSchedule: Partial<ScheduledExport> = {
    id: 1,
    store_id: 1,
    name: 'Monthly Report',
    export_type: 'csv',
    sections: ['quotes', 'appointments'],
    cron_expression: '0 9 * * 1',
    recipients: [{ email: 'test@example.com' }],
    enabled: true,
    last_executed_at: null,
    next_execution_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledExportService,
        {
          provide: getRepositoryToken(ScheduledExport),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            findOneByOrFail: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScheduledExportLog),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScheduledExportService>(ScheduledExportService);
    scheduleRepo = module.get(getRepositoryToken(ScheduledExport));
    logRepo = module.get(getRepositoryToken(ScheduledExportLog));
  });

  describe('create', () => {
    it('should create a scheduled export', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValue(null);
      (scheduleRepo.create as jest.Mock).mockReturnValue(mockSchedule as ScheduledExport);
      (scheduleRepo.save as jest.Mock).mockResolvedValue(mockSchedule as ScheduledExport);

      const result = await service.create(1, {
        name: 'Monthly Report',
        export_type: 'csv',
        sections: ['quotes'],
        cron_expression: '0 9 * * 1',
        recipients: [{ email: 'test@example.com' }],
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Monthly Report');
      expect(scheduleRepo.save).toHaveBeenCalled();
    });

    it('should throw when cron expression is invalid', async () => {
      await expect(
        service.create(1, {
          name: 'Bad Config',
          export_type: 'csv',
          sections: ['quotes'],
          cron_expression: 'invalid',
          recipients: [{ email: 'test@example.com' }],
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw when duplicate name in same store', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValue(mockSchedule as ScheduledExport);

      await expect(
        service.create(1, {
          name: 'Monthly Report',
          export_type: 'csv',
          sections: ['quotes'],
          cron_expression: '0 9 * * 1',
          recipients: [{ email: 'test@example.com' }],
        }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('findAll', () => {
    it('should return scheduled exports for a store', async () => {
      (scheduleRepo.find as jest.Mock).mockResolvedValue([mockSchedule] as ScheduledExport[]);

      const result = await service.findAll(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Monthly Report');
    });

    it('should return empty when no exports exist', async () => {
      (scheduleRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update a scheduled export', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValueOnce(mockSchedule as ScheduledExport);
      (scheduleRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (scheduleRepo.findOneByOrFail as jest.Mock).mockResolvedValue({
        ...mockSchedule,
        name: 'New Name',
      } as ScheduledExport);

      const result = await service.update(1, 1, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(scheduleRepo.update).toHaveBeenCalled();
    });

    it('should throw when schedule not found', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, 1, { name: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should validate cron expression on update', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValueOnce(mockSchedule as ScheduledExport);

      await expect(
        service.update(1, 1, { cron_expression: 'bad' }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should soft-delete a schedule', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValue(mockSchedule as ScheduledExport);
      (scheduleRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.delete(1, 1);

      expect(scheduleRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ deleted_at: expect.any(Date) }));
    });

    it('should throw when schedule not found', async () => {
      (scheduleRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.delete(999, 1)).rejects.toThrow(BusinessException);
    });
  });

  describe('getLogs', () => {
    it('should return export logs for a schedule', async () => {
      const mockLog = {
        id: 1,
        schedule_id: 1,
        status: 'success' as const,
        file_url: null,
        error_message: null,
        executed_at: new Date(),
      };
      (logRepo.find as jest.Mock).mockResolvedValue([mockLog] as ScheduledExportLog[]);

      const result = await service.getLogs(1);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('success');
    });

    it('should return empty when no logs exist', async () => {
      (logRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getLogs(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('processScheduledExports', () => {
    it('should process pending exports', async () => {
      const dueSchedule = {
        ...mockSchedule,
        id: 1,
        cron_expression: '0 9 * * 1',
        next_execution_at: new Date(Date.now() - 1000),
      };
      const mockLog = {
        id: 1,
        schedule_id: 1,
        status: 'success' as const,
        file_url: null,
        error_message: null,
        executed_at: new Date(),
      };

      (scheduleRepo.find as jest.Mock).mockResolvedValue([dueSchedule] as ScheduledExport[]);
      (logRepo.create as jest.Mock).mockReturnValue(mockLog as ScheduledExportLog);
      (logRepo.save as jest.Mock).mockResolvedValue(mockLog as ScheduledExportLog);
      (scheduleRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (scheduleRepo.findOneByOrFail as jest.Mock).mockImplementation(() => {
        throw new Error('should not be called');
      });

      await service.processScheduledExports();

      expect(logRepo.save).toHaveBeenCalled();
      expect(scheduleRepo.update).toHaveBeenCalled();
    });

    it('should handle export failures gracefully', async () => {
      const dueSchedule = {
        ...mockSchedule,
        cron_expression: '0 9 * * 1',
        next_execution_at: new Date(Date.now() - 1000),
      };
      const error = new Error('Export failed');
      let saveCallCount = 0;

      (scheduleRepo.find as jest.Mock).mockResolvedValue([dueSchedule] as ScheduledExport[]);
      (logRepo.create as jest.Mock).mockReturnValue({} as ScheduledExportLog);
      (logRepo.save as jest.Mock).mockImplementation(() => {
        saveCallCount++;
        if (saveCallCount === 1) throw error; // first save fails
        return {};
      });
      (scheduleRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.processScheduledExports();

      // Should log error and continue
      expect(logRepo.save).toHaveBeenCalledTimes(2);
    });
  });
});
