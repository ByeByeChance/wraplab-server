import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { AiGeneration } from './entities/ai-generation.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { QueueService } from '../queue/queue.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('AiService', () => {
  let service: AiService;
  let generationRepo: jest.Mocked<
    Pick<Repository<AiGeneration>, 'findOne' | 'find' | 'findAndCount' | 'create' | 'save' | 'update' | 'count'>
  > & { manager: { transaction: jest.Mock } };
  let configRepo: jest.Mocked<Pick<Repository<Configuration>, 'findOne'>>;

  const mockConfig: Partial<Configuration> = {
    id: 10,
    store_id: 1,
    model_id: 1,
    status: 'confirmed' as const,
    staff_id: 1,
    name: 'test config',
    note: null,
    customer_name: null,
    customer_phone: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    model: {
      id: 1,
      series_id: 1,
      name: 'Model S',
      year: 2024,
      body_type: 'sedan',
      model_3d_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      series: {
        id: 1,
        brand_id: 1,
        name: 'S Series',
        year_start: null,
        year_end: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        brand: {
          id: 1,
          name: 'Tesla',
          logo: null,
          sort_order: 0,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      },
    } as unknown as Configuration['model'],
    partColors: [
      {
        id: 1,
        store_id: 1,
        configuration_id: 10,
        part_code: 'FULL',
        color_swatch_id: 1,
        material_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        colorSwatch: { id: 1, name: 'Matte Black' } as unknown,
        material: { id: 1, name: '哑面' } as unknown,
      },
    ] as unknown as Configuration['partColors'],
  };

  const mockGeneration: Partial<AiGeneration> = {
    id: 1,
    store_id: 1,
    configuration_id: 10,
    prompt_text: 'a test prompt',
    style: 'scene' as const,
    status: 'pending' as const,
    result_image_url: null,
    error_message: null,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);
    (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

    // Set env defaults for quota
    process.env.AI_GENERATION_MONTHLY_QUOTA = '100';
    process.env.AI_GENERATION_TIMEOUT_MS = '300000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(AiGeneration),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            manager: {
              transaction: jest.fn().mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
                const mockManager = {
                  count: jest.fn().mockResolvedValue(5),
                  create: jest.fn().mockReturnValue(mockGeneration as AiGeneration),
                  save: jest.fn().mockResolvedValue({ ...mockGeneration, id: 1 } as AiGeneration),
                };
                return fn(mockManager);
              }),
            },
          },
        },
        {
          provide: getRepositoryToken(Configuration),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'IAiProvider',
          useValue: {
            generateImage: jest.fn(),
            queryTask: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: { add: jest.fn().mockResolvedValue({ id: 'test-job-1' }) },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    generationRepo = module.get(getRepositoryToken(AiGeneration));
    configRepo = module.get(getRepositoryToken(Configuration));
  });

  describe('generateImage', () => {
    it('should create generation task and return pending status', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      generationRepo.count.mockResolvedValue(5); // under quota (note: transaction uses inner mock)

      const result = await service.generateImage(10, { style: 'scene' });

      expect(result.generation_id).toBe(1);
      expect(result.status).toBe('queued');
      expect(generationRepo.manager.transaction).toHaveBeenCalled();
    });

    it('should throw when configuration not found', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.generateImage(999, { style: 'scene' })).rejects.toThrow(BusinessException);
    });

    it('should enforce monthly quota', async () => {
      // Set quota to 10
      process.env.AI_GENERATION_MONTHLY_QUOTA = '10';

      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      generationRepo.count.mockResolvedValue(10); // exactly at quota

      await expect(service.generateImage(10, { style: 'scene' })).rejects.toThrow(BusinessException);
    });

    it('should allow generation when under quota', async () => {
      process.env.AI_GENERATION_MONTHLY_QUOTA = '10';

      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      generationRepo.count.mockResolvedValue(9); // one under quota (note: transaction uses inner mock)

      const result = await service.generateImage(10, { style: 'scene' });

      expect(result.status).toBe('queued');
    });
  });

  describe('findOne', () => {
    it('should return single generation with relations', async () => {
      generationRepo.findOne.mockResolvedValue(mockGeneration as AiGeneration);

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(generationRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, relations: ['configuration'] }),
      );
    });

    it('should throw when generation not found', async () => {
      generationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('findByConfigId', () => {
    it('should return generations ordered by created_at DESC', async () => {
      const generations = [mockGeneration];
      generationRepo.find.mockResolvedValue(generations as AiGeneration[]);

      const result = await service.findByConfigId(10);

      expect(result).toHaveLength(1);
      expect(generationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { configuration_id: 10 },
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('should return empty array when no generations', async () => {
      generationRepo.find.mockResolvedValue([]);

      const result = await service.findByConfigId(10);

      expect(result).toHaveLength(0);
    });
  });

  describe('handleCallback', () => {
    const pendingGen = { ...mockGeneration, status: 'pending' as const, store_id: 1 };

    it('should update status to completed with result_image_url', async () => {
      generationRepo.findOne.mockResolvedValue(pendingGen as AiGeneration);
      generationRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<
        Repository<AiGeneration>['update']
      >);

      await service.handleCallback({
        generation_id: 1,
        status: 'completed',
        result_image_url: 'https://oss.example.com/gen-1.png',
      });

      expect(generationRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'completed',
          result_image_url: 'https://oss.example.com/gen-1.png',
        }),
      );
    });

    it('should update status to failed with error_message', async () => {
      generationRepo.findOne.mockResolvedValue(pendingGen as AiGeneration);
      generationRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<
        Repository<AiGeneration>['update']
      >);

      await service.handleCallback({
        generation_id: 1,
        status: 'failed',
        error_message: 'AI service unavailable',
      });

      expect(generationRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'failed',
          error_message: 'AI service unavailable',
        }),
      );
    });

    it('should verify store ownership and reject unauthorized', async () => {
      const genFromOtherStore = { ...pendingGen, store_id: 999 };
      generationRepo.findOne.mockResolvedValue(genFromOtherStore as AiGeneration);

      await expect(
        service.handleCallback({
          generation_id: 1,
          status: 'completed',
          result_image_url: 'https://example.com/img.png',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('should reject when generation not found', async () => {
      generationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleCallback({
          generation_id: 999,
          status: 'completed',
          result_image_url: 'https://example.com/img.png',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('should reject update on already completed generation', async () => {
      const completedGen = { ...pendingGen, status: 'completed' as const };
      generationRepo.findOne.mockResolvedValue(completedGen as AiGeneration);

      await expect(
        service.handleCallback({
          generation_id: 1,
          status: 'completed',
          result_image_url: 'https://example.com/img2.png',
        }),
      ).rejects.toThrow(BusinessException);
    });
  });
});
