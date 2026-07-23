import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SmsService } from './sms.service';
import { SmsCode } from './entities/sms-code.entity';
import { ISmsProvider } from './interfaces/sms-provider.interface';
import { QueueService } from '../queue/queue.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('SmsService', () => {
  let service: SmsService;
  let smsCodeRepo: jest.Mocked<
    Pick<Repository<SmsCode>, 'findOne' | 'findAndCount' | 'create' | 'save' | 'update' | 'count'>
  >;
  let smsProvider: jest.Mocked<ISmsProvider>;
  let queueService: jest.Mocked<Pick<QueueService, 'add'>>;

  const mockSmsCode: Partial<SmsCode> = {
    id: 1,
    phone: '13800138000',
    code: '123456',
    type: 'login' as const,
    expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    used: 0,
    created_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: getRepositoryToken(SmsCode),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'ISmsProvider',
          useValue: {
            send: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QueueService,
          useValue: { add: jest.fn().mockResolvedValue({ id: 'test-job-1' }) },
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    smsCodeRepo = module.get(getRepositoryToken(SmsCode));
    smsProvider = module.get('ISmsProvider');
    queueService = module.get(QueueService);
  });

  describe('sendCode', () => {
    it('should create SMS code record and return expires_at', async () => {
      smsCodeRepo.findOne.mockResolvedValue(null); // no recent code
      smsCodeRepo.count.mockResolvedValue(0); // under daily limit
      smsCodeRepo.create.mockReturnValue(mockSmsCode as SmsCode);
      smsCodeRepo.save.mockResolvedValue(mockSmsCode as SmsCode);

      const result = await service.sendCode({ phone: '13800138000', type: 'login' });

      expect(result.expires_at).toBeDefined();
      expect(smsCodeRepo.save).toHaveBeenCalled();
      expect(queueService.add).toHaveBeenCalledWith(
        'notification',
        'send-sms',
        expect.objectContaining({
          phone: '13800138000',
          code: expect.any(String),
          type: 'login',
        }),
      );
    });

    it('should enforce 60s rate limit', async () => {
      smsCodeRepo.findOne.mockResolvedValue(mockSmsCode as SmsCode); // recent code exists

      await expect(service.sendCode({ phone: '13800138000', type: 'login' })).rejects.toThrow(BusinessException);
    });

    it('should enforce 10/day limit', async () => {
      smsCodeRepo.findOne.mockResolvedValue(null); // no recent code (past 60s)
      smsCodeRepo.count.mockResolvedValue(10); // at daily limit

      await expect(service.sendCode({ phone: '13800138000', type: 'login' })).rejects.toThrow(BusinessException);
    });

    it('should allow send when under daily limit', async () => {
      smsCodeRepo.findOne.mockResolvedValue(null);
      smsCodeRepo.count.mockResolvedValue(9); // one under limit
      smsCodeRepo.create.mockReturnValue(mockSmsCode as SmsCode);
      smsCodeRepo.save.mockResolvedValue(mockSmsCode as SmsCode);

      const result = await service.sendCode({ phone: '13800138000', type: 'login' });

      expect(result.expires_at).toBeDefined();
    });

    it('should still return expires_at even when queue is unavailable (test mode)', async () => {
      smsCodeRepo.findOne.mockResolvedValue(null);
      smsCodeRepo.count.mockResolvedValue(0);
      smsCodeRepo.create.mockReturnValue(mockSmsCode as SmsCode);
      smsCodeRepo.save.mockResolvedValue(mockSmsCode as SmsCode);
      queueService.add.mockResolvedValue(null); // queue not available

      const result = await service.sendCode({ phone: '13800138000', type: 'login' });

      expect(result.expires_at).toBeDefined();
      expect(queueService.add).toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('should mark code as used and return true', async () => {
      smsCodeRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<SmsCode>['update']>);
      smsCodeRepo.findOne.mockResolvedValue(mockSmsCode as SmsCode);

      const result = await service.verifyCode('13800138000', '123456', 'login');

      expect(result).toBe(true);
      expect(smsCodeRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '13800138000',
          type: 'login',
          used: 0,
        }),
        { used: 1 },
      );
    });

    it('should reject expired code', async () => {
      smsCodeRepo.update.mockResolvedValue({ affected: 0 } as unknown as ReturnType<Repository<SmsCode>['update']>);

      await expect(service.verifyCode('13800138000', '123456', 'login')).rejects.toThrow(BusinessException);
    });

    it('should reject wrong code', async () => {
      smsCodeRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<SmsCode>['update']>);
      // Code in mock is '123456', but user provides '654321'
      smsCodeRepo.findOne.mockResolvedValue({ ...mockSmsCode, code: '123456' } as SmsCode);

      await expect(service.verifyCode('13800138000', '654321', 'login')).rejects.toThrow(BusinessException);
    });

    it('should reject already-used code', async () => {
      // update returns affected: 0 because the code is already used (used=1, so no rows match used=0)
      smsCodeRepo.update.mockResolvedValue({ affected: 0 } as unknown as ReturnType<Repository<SmsCode>['update']>);

      await expect(service.verifyCode('13800138000', '123456', 'login')).rejects.toThrow(BusinessException);
    });

    it('should reject when no code found after update', async () => {
      smsCodeRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<SmsCode>['update']>);
      smsCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyCode('13800138000', '123456', 'login')).rejects.toThrow(BusinessException);
    });
  });
});
