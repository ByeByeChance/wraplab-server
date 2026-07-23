import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { Store } from '../store/entities/store.entity';
import { SmsService } from '../sms/sms.service';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('AppointmentService', () => {
  let service: AppointmentService;

  const mockAppointmentRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const mockStoreRepo = {
    findOne: jest.fn(),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };
  const mockSmsService = {
    sendCode: jest.fn(),
    verifyCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(Store), useValue: mockStoreRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SmsService, useValue: mockSmsService },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
  });

  describe('create', () => {
    const dto = {
      store_id: 1,
      customer_name: 'Test',
      customer_phone: '13800138000',
      service_type: 'CONSULTATION',
      appointment_date: '2026-08-01',
      time_slot: 'MORNING' as const,
    };

    it('should create an appointment when capacity available', async () => {
      mockStoreRepo.findOne.mockResolvedValue({ id: 1, status: 'active' } as Store);

      // Mock transaction to pass capacity check
      mockAppointmentRepo.manager.transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        // Create a mock manager for the transaction with create, save, and query builder
        const mockManager = {
          create: jest.fn().mockReturnValue({ id: 1, ...dto, status: 'pending' } as Appointment),
          save: jest.fn().mockResolvedValue({ id: 1, ...dto, status: 'pending' } as Appointment),
          createQueryBuilder: () => ({
            select: () => ({
              where: () => ({
                andWhere: () => ({
                  andWhere: () => ({
                    andWhere: () => ({
                      setLock: () => ({
                        getRawOne: () => Promise.resolve({ cnt: 5 }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
        return fn(mockManager);
      });

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should throw when store not found', async () => {
      mockStoreRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow('Store not found');
    });

    it('should throw when store is inactive', async () => {
      mockStoreRepo.findOne.mockResolvedValue({ id: 1, status: 'inactive' } as Store);

      await expect(service.create(dto)).rejects.toThrow('Store is not active');
    });
  });

  describe('confirm', () => {
    it('should confirm a pending appointment', async () => {
      const appointment = {
        id: 1,
        store_id: 1,
        status: 'pending',
        customer_name: 'Test',
        customer_phone: '13800138000',
      } as Appointment;

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockAppointmentRepo.save.mockResolvedValue({ ...appointment, status: 'confirmed' });

      const result = await service.confirm(1);

      expect(result.status).toBe('confirmed');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('appointment.confirmed', expect.any(Object));
    });

    it('should throw when appointment not found', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue(null);

      await expect(service.confirm(999)).rejects.toThrow('Appointment not found');
    });

    it('should throw invalid transition for already confirmed', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'confirmed',
      } as Appointment);

      await expect(service.confirm(1)).rejects.toThrow('Cannot confirm appointment');
    });

    it('should throw invalid transition for already cancelled', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'cancelled',
      } as Appointment);

      await expect(service.confirm(1)).rejects.toThrow('Cannot confirm appointment');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending appointment', async () => {
      const appointment = {
        id: 1,
        status: 'pending',
      } as Appointment;

      mockAppointmentRepo.findOne.mockResolvedValue(appointment);
      mockAppointmentRepo.save.mockResolvedValue({
        ...appointment,
        status: 'cancelled',
        cancel_reason: 'Customer request',
      });

      const result = await service.cancel(1, 'Customer request');

      expect(result.status).toBe('cancelled');
      expect(result.cancel_reason).toBe('Customer request');
    });

    it('should throw for transition from completed', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'completed',
      } as Appointment);

      await expect(service.cancel(1, 'reason')).rejects.toThrow('Cannot cancel appointment');
    });
  });

  describe('findSlots', () => {
    it('should return availability for all slots', async () => {
      mockAppointmentRepo.count.mockResolvedValue(3);

      const result = await service.findSlots(1, '2026-08-01');

      expect(result.slots).toHaveLength(3);
      expect(result.slots[0].available).toBe(17); // 20 - 3
    });
  });

  describe('getServiceTypes', () => {
    it('should return service types list', () => {
      const types = service.getServiceTypes();
      expect(types).toHaveLength(4);
      expect(types[0]).toHaveProperty('value');
      expect(types[0]).toHaveProperty('label');
    });
  });

  describe('reschedule', () => {
    it('should reschedule a confirmed appointment', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 1,
        store_id: 1,
        status: 'confirmed',
        appointment_date: '2026-08-01',
        time_slot: 'MORNING',
      } as Appointment);

      mockAppointmentRepo.count.mockResolvedValue(5); // Capacity available
      mockAppointmentRepo.save.mockResolvedValue({
        id: 1,
        store_id: 1,
        status: 'confirmed',
        appointment_date: '2026-08-02',
        time_slot: 'AFTERNOON',
      } as Appointment);

      const result = await service.reschedule(1, {
        appointment_date: '2026-08-02',
        time_slot: 'AFTERNOON',
      });

      expect(result.appointment_date).toBe('2026-08-02');
      expect(result.time_slot).toBe('AFTERNOON');
    });

    it('should throw when rescheduling a non-confirmed appointment', async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'pending',
      } as Appointment);

      await expect(service.reschedule(1, { appointment_date: '2026-08-02', time_slot: 'AFTERNOON' })).rejects.toThrow(
        'Only confirmed appointments can be rescheduled',
      );
    });
  });

  describe('findMine', () => {
    it('should return paginated appointments for store', async () => {
      mockAppointmentRepo.findAndCount.mockResolvedValue([[{ id: 1, store_id: 1 } as Appointment], 1]);

      const result = await service.findMine({ page: 1, size: 20, skip: 0, take: 20 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should return all paginated appointments', async () => {
      mockAppointmentRepo.findAndCount.mockResolvedValue([[{ id: 1 } as Appointment, { id: 2 } as Appointment], 2]);

      const result = await service.findAll({ page: 1, size: 20, skip: 0, take: 20 });

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
