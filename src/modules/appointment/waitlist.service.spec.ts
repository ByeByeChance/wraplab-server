import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WaitlistService } from './waitlist.service';
import { AppointmentWaitlist } from './entities/appointment-waitlist.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let waitlistRepo: jest.Mocked<Repository<AppointmentWaitlist>>;
  let storeRepo: jest.Mocked<Repository<Store>>;

  const mockStore: Store = {
    id: 1,
    name: 'Test Store',
    address: 'Address',
    location: null,
    business_hours: null,
    services_offered: null,
    capacity_config: null,
    region: null,
    phone: '021-12345678',
    logo: null,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as Store;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: getRepositoryToken(AppointmentWaitlist),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            manager: {
              transaction: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    waitlistRepo = module.get(getRepositoryToken(AppointmentWaitlist));
    storeRepo = module.get(getRepositoryToken(Store));
  });

  describe('join', () => {
    const joinDto = {
      store_id: 1,
      appointment_date: '2026-07-25',
      time_slot_id: 1,
      customer_name: 'Test Customer',
      customer_phone: '13800138000',
      service_type: 'full_wrap' as const,
    };

    it('should join waitlist successfully', async () => {
      storeRepo.findOne.mockResolvedValue(mockStore);
      waitlistRepo.findOne.mockResolvedValue(null);
      waitlistRepo.count.mockResolvedValue(0);
      waitlistRepo.create.mockReturnValue({} as unknown as AppointmentWaitlist);
      waitlistRepo.save.mockResolvedValue({
        id: BigInt(1),
        position: 1,
        status: 'waiting',
      } as unknown as AppointmentWaitlist);

      const result = await service.join(joinDto);

      expect(result.position).toBe(1);
      expect(result.status).toBe('waiting');
    });

    it('should throw when store not exists', async () => {
      storeRepo.findOne.mockResolvedValue(null);

      await expect(service.join(joinDto)).rejects.toThrow(BusinessException);
    });

    it('should throw when already joined', async () => {
      storeRepo.findOne.mockResolvedValue(mockStore);
      waitlistRepo.findOne.mockResolvedValue({ id: BigInt(1) } as unknown as AppointmentWaitlist);

      await expect(service.join(joinDto)).rejects.toThrow(BusinessException);
    });

    it('should throw when waitlist is full', async () => {
      storeRepo.findOne.mockResolvedValue(mockStore);
      waitlistRepo.findOne.mockResolvedValue(null);
      waitlistRepo.count.mockResolvedValue(20);

      await expect(service.join(joinDto)).rejects.toThrow(BusinessException);
    });
  });

  describe('getStatus', () => {
    it('should return waitlist status', async () => {
      waitlistRepo.findOne.mockResolvedValue({
        id: BigInt(1),
        appointment_date: '2026-07-25',
        time_slot_id: BigInt(1),
        position: 3,
        status: 'waiting',
      } as unknown as AppointmentWaitlist);

      const result = await service.getStatus('13800138000');

      expect(result).not.toBeNull();
      expect(result!.position).toBe(3);
    });

    it('should return null when not in waitlist', async () => {
      waitlistRepo.findOne.mockResolvedValue(null);

      const result = await service.getStatus('13800138000');

      expect(result).toBeNull();
    });
  });

  describe('cancel', () => {
    it('should cancel waitlist entry', async () => {
      waitlistRepo.findOne.mockResolvedValue({
        id: BigInt(1),
        time_slot_id: BigInt(1),
        appointment_date: '2026-07-25',
        position: 2,
        status: 'waiting',
        customer_phone: '13800138000',
      } as unknown as AppointmentWaitlist);

      const mockManager = {
        update: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      (waitlistRepo.manager as unknown as jest.Mocked<{ transaction: jest.Mock }>).transaction = jest.fn(
        (cb: (...args: unknown[]) => unknown) => cb(mockManager),
      );

      await service.cancel(1, '13800138000');

      expect(mockManager.update).toHaveBeenCalled();
    });
  });
});
