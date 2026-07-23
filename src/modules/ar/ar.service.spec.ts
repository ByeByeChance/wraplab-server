import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArService } from './ar.service';
import { Configuration } from '../configuration/entities/configuration.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('ArService', () => {
  let service: ArService;
  let configRepo: jest.Mocked<Pick<Repository<Configuration>, 'findOne'>>;
  let modelRepo: jest.Mocked<Pick<Repository<CarModel>, 'findOne'>>;

  const mockConfig: Partial<Configuration> = {
    id: 1,
    store_id: 1,
    model_id: 10,
    name: 'Test Config',
    status: 'confirmed',
    model: {
      id: 10,
      name: '325Li',
      model_3d_url: 'https://oss.wraplab.com/ar/bmw.usdz',
    } as CarModel,
    partColors: [
      {
        part_code: 'HOOD',
        colorSwatch: {
          id: 1,
          hex: '#FF0000',
        },
      },
    ],
  } as Configuration;

  const mockModel: Partial<CarModel> = {
    id: 10,
    name: '325Li',
    model_3d_url: 'https://oss.wraplab.com/ar/bmw.usdz',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArService,
        {
          provide: getRepositoryToken(Configuration),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(CarModel),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ArService>(ArService);
    configRepo = module.get(getRepositoryToken(Configuration));
    modelRepo = module.get(getRepositoryToken(CarModel));
  });

  describe('getArTexture', () => {
    it('should return AR texture data with colors', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);

      const result = await service.getArTexture(1);

      expect(result.configuration_id).toBe(1);
      expect(result.model_id).toBe(10);
      expect(result.ar_model_url).toContain('usdz');
      expect(result.colors).toHaveLength(1);
      expect(result.colors[0].hex).toBe('#FF0000');
    });

    it('should throw when configuration not found', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.getArTexture(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('getArConfig', () => {
    it('should return AR model config', async () => {
      modelRepo.findOne.mockResolvedValue(mockModel as CarModel);

      const result = await service.getArConfig(10);

      expect(result.model_id).toBe(10);
      expect(result.ar_model_url).toContain('usdz');
      expect(result.tracking_type).toBe('plane_detection');
    });

    it('should throw when model not found', async () => {
      modelRepo.findOne.mockResolvedValue(null);

      await expect(service.getArConfig(999)).rejects.toThrow(BusinessException);
    });
  });
});
