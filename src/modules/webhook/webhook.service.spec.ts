import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookService } from './webhook.service';
import { WebhookConfig } from './entities/webhook-config.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('WebhookService', () => {
  let service: WebhookService;
  let configRepo: jest.Mocked<Pick<Repository<WebhookConfig>, 'findOne' | 'create' | 'save'>>;

  const mockConfig: Partial<WebhookConfig> = {
    id: 1,
    store_id: 1,
    type: 'wecom',
    url: 'https://qyapi.weixin.qq.com/webhook',
    events: ['customer.created', 'appointment.created'],
    status: 1,
    secret: 'test-secret',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(WebhookConfig),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    configRepo = module.get(getRepositoryToken(WebhookConfig));
  });

  describe('upsert', () => {
    it('should create new webhook config', async () => {
      configRepo.findOne.mockResolvedValue(null);
      configRepo.create.mockReturnValue(mockConfig as WebhookConfig);
      configRepo.save.mockResolvedValue(mockConfig as WebhookConfig);

      const result = await service.upsert({
        type: 'wecom',
        url: 'https://qyapi.weixin.qq.com/webhook',
        events: ['customer.created'],
        status: true,
        secret: 'secret',
      });

      expect(result).toBeDefined();
      expect(configRepo.create).toHaveBeenCalled();
    });

    it('should update existing webhook config', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as WebhookConfig);
      configRepo.save.mockResolvedValue({ ...mockConfig, url: 'https://new.example.com' } as WebhookConfig);

      const result = await service.upsert({
        type: 'wecom',
        url: 'https://new.example.com',
        events: ['customer.created'],
        status: true,
      });

      expect(result.url).toBe('https://new.example.com');
    });

    it('should throw on non-HTTPS URL', async () => {
      await expect(
        service.upsert({
          type: 'wecom',
          url: 'http://insecure.example.com',
          events: ['customer.created'],
          status: true,
        }),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('getConfig', () => {
    it('should return config for store', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as WebhookConfig);

      const result = await service.getConfig();

      expect(result).toBeDefined();
      expect(configRepo.findOne).toHaveBeenCalled();
    });

    it('should return null when no config exists', async () => {
      configRepo.findOne.mockResolvedValue(null);

      const result = await service.getConfig();

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should soft delete webhook config', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as WebhookConfig);
      configRepo.save.mockResolvedValue(mockConfig as WebhookConfig);

      await service.delete();

      expect(configRepo.save).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(Date) }));
    });

    it('should throw when config not found', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.delete()).rejects.toThrow(BusinessException);
    });
  });

  describe('signature', () => {
    it('should verify valid HMAC signature', () => {
      const secret = 'test-secret';
      const payload = 'test-payload';
      const signature = service.signPayload(payload, secret);

      expect(service.verifySignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      expect(service.verifySignature('payload', 'bad-signature', 'secret')).toBe(false);
    });

    it('should return false when secret is empty', () => {
      expect(service.verifySignature('payload', 'sig', '')).toBe(false);
    });
  });
});
