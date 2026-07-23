import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { Staff } from '../staff/entities/staff.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { SmsService } from '../sms/sms.service';
import { RedisService } from '../redis/redis.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let staffRepo: jest.Mocked<Repository<Staff>>;
  let jwtService: jest.Mocked<JwtService>;
  let smsService: jest.Mocked<Pick<SmsService, 'sendCode' | 'verifyCode'>>;

  const mockStaff = {
    id: 1,
    store_id: 1,
    current_store_id: 1,
    phone: '13800138000',
    password_hash: '$2b$12$hashedpassword',
    role: 'staff' as const,
    status: 'active' as const,
    token_version: 0,
    name: 'Test',
    wechat_openid: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const defaults: Record<string, unknown> = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '7200',
                JWT_REFRESH_EXPIRES_IN: '604800',
              };
              return defaults[key] ?? process.env[key];
            }),
          },
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StaffStore),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            axiosRef: { get: jest.fn(), post: jest.fn() },
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendCode: jest.fn(),
            verifyCode: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(null),
              set: jest.fn(),
              del: jest.fn(),
              incr: jest.fn().mockResolvedValue(1),
              expire: jest.fn(),
              ttl: jest.fn().mockResolvedValue(900),
            }),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            decrypt: jest.fn((value: string) => value),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    staffRepo = module.get(getRepositoryToken(Staff));
    jwtService = module.get(JwtService);
    smsService = module.get(SmsService);
    // Mock staffStoreRepo to return empty array for all tests
    const staffStoreRepo = module.get(getRepositoryToken(StaffStore));
    staffStoreRepo.find.mockResolvedValue([]);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login({
        phone: '13800138000',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should throw LOGIN_FAILED when phone not found', async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(service.login({ phone: '13800138000', password: 'any' })).rejects.toThrow(BusinessException);
    });

    it('should throw LOGIN_FAILED when password is incorrect', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ phone: '13800138000', password: 'wrong' })).rejects.toThrow(BusinessException);
    });

    it('should throw ACCOUNT_DISABLED when staff is disabled', async () => {
      staffRepo.findOne.mockResolvedValue({
        ...mockStaff,
        status: 'disabled',
      } as Staff);

      await expect(service.login({ phone: '13800138000', password: 'test' })).rejects.toThrow(BusinessException);
    });
  });

  describe('sendSmsCode', () => {
    it('should send SMS code for registered phone', async () => {
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      smsService.sendCode.mockResolvedValue({ expires_at: new Date().toISOString() });

      const result = await service.sendSmsCode('13800138000');

      expect(result.expires_at).toBeDefined();
      expect(smsService.sendCode).toHaveBeenCalledWith({ phone: '13800138000', type: 'login' });
    });

    it('should throw when phone not registered', async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(service.sendSmsCode('13900139000')).rejects.toThrow(BusinessException);
    });

    it('should throw when account is disabled', async () => {
      staffRepo.findOne.mockResolvedValue({
        ...mockStaff,
        status: 'disabled',
      } as Staff);

      await expect(service.sendSmsCode('13800138000')).rejects.toThrow(BusinessException);
    });
  });

  describe('smsLogin', () => {
    it('should return tokens on valid SMS code', async () => {
      smsService.verifyCode.mockResolvedValue(true);
      staffRepo.findOne.mockResolvedValue(mockStaff as Staff);
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.smsLogin({
        phone: '13800138000',
        sms_code: '123456',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(smsService.verifyCode).toHaveBeenCalledWith('13800138000', '123456', 'login');
    });

    it('should throw when SMS code is invalid', async () => {
      smsService.verifyCode.mockRejectedValue(new BusinessException(1012 as never, '验证码错误'));

      await expect(service.smsLogin({ phone: '13800138000', sms_code: '000000' })).rejects.toThrow(BusinessException);
    });

    it('should throw when phone not registered', async () => {
      smsService.verifyCode.mockResolvedValue(true);
      staffRepo.findOne.mockResolvedValue(null);

      await expect(service.smsLogin({ phone: '13800138000', sms_code: '123456' })).rejects.toThrow(BusinessException);
    });

    it('should throw when account is disabled', async () => {
      smsService.verifyCode.mockResolvedValue(true);
      staffRepo.findOne.mockResolvedValue({
        ...mockStaff,
        status: 'disabled',
      } as Staff);

      await expect(service.smsLogin({ phone: '13800138000', sms_code: '123456' })).rejects.toThrow(BusinessException);
    });
  });
});
