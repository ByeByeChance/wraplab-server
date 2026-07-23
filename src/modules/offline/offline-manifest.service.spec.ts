import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { OfflineManifestService } from './offline-manifest.service';
import { Case } from '../case/entities/case.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorBrand } from '../color/entities/color-brand.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';

describe('OfflineManifestService', () => {
  let service: OfflineManifestService;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'find'>>;
  let carModelRepo: jest.Mocked<Pick<Repository<CarModel>, 'find'>>;
  let colorSwatchRepo: jest.Mocked<Pick<Repository<ColorSwatch>, 'find'>>;
  let colorBrandRepo: jest.Mocked<Pick<Repository<ColorBrand>, 'find'>>;

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 1,
    title: 'Cool Case',
    cover_image_url: 'https://img.example.com/case1.jpg',
    status: 'published',
    view_count: 100,
    like_count: 50,
    share_count: 0,
    comment_count: 0,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date('2026-07-20'),
    deleted_at: null,
  };

  const mockCarModel: Partial<CarModel> = {
    id: 1,
    series_id: 1,
    name: 'Model 3',
    year: 2024,
    model_3d_url: 'https://cdn.example.com/model3.glb',
    created_at: new Date(),
    updated_at: new Date('2026-07-15'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfflineManifestService,
        {
          provide: getRepositoryToken(Case),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(CarModel),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ColorSwatch),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ColorBrand),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OfflineManifestService>(OfflineManifestService);
    caseRepo = module.get(getRepositoryToken(Case));
    carModelRepo = module.get(getRepositoryToken(CarModel));
    colorSwatchRepo = module.get(getRepositoryToken(ColorSwatch));
    colorBrandRepo = module.get(getRepositoryToken(ColorBrand));
  });

  describe('generate', () => {
    it('should generate full manifest with all resource types', async () => {
      (caseRepo.find as jest.Mock).mockResolvedValue([mockCase] as Case[]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([mockCarModel] as CarModel[]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(1);

      expect(result.is_full).toBe(true);
      expect(result.generated_at).toBeDefined();
      expect(result.resources.length).toBeGreaterThan(0);

      // Should have case cover resources
      const caseResource = result.resources.find((r) => r.type === 'case');
      expect(caseResource).toBeDefined();
      expect(caseResource!.url).toBe('https://img.example.com/case1.jpg');

      // Should have vehicle model resources
      const vehicleResource = result.resources.find((r) => r.type === 'vehicle');
      expect(vehicleResource).toBeDefined();
      expect(vehicleResource!.url).toBe('https://cdn.example.com/model3.glb');

      // Should have config resources
      const configResources = result.resources.filter((r) => r.type === 'config');
      expect(configResources.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter cases without cover images', async () => {
      const caseWithoutCover: Partial<Case> = {
        ...mockCase,
        id: 2,
        cover_image_url: null,
      };
      (caseRepo.find as jest.Mock).mockResolvedValue([mockCase, caseWithoutCover] as Case[]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(1);

      const caseResources = result.resources.filter((r) => r.type === 'case');
      expect(caseResources).toHaveLength(1);
      expect(caseResources[0].url).toBe('https://img.example.com/case1.jpg');
    });

    it('should filter car models without 3D URLs', async () => {
      const modelWithout3D: Partial<CarModel> = {
        ...mockCarModel,
        id: 2,
        model_3d_url: null,
      };
      (caseRepo.find as jest.Mock).mockResolvedValue([]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([mockCarModel, modelWithout3D] as CarModel[]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(1);

      const vehicleResources = result.resources.filter((r) => r.type === 'vehicle');
      expect(vehicleResources).toHaveLength(1);
    });

    it('should return incremental manifest when since parameter provided', async () => {
      const oldCase: Partial<Case> = {
        ...mockCase,
        id: 2,
        updated_at: new Date('2026-07-01'),
      };
      (caseRepo.find as jest.Mock).mockResolvedValue([mockCase, oldCase] as Case[]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([mockCarModel] as CarModel[]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(1, '2026-07-10T00:00:00.000Z');

      expect(result.is_full).toBe(false);
      // Only resources updated after since date should be included
      // mockCase updated_at 2026-07-20 > since, should be included
      // oldCase updated_at 2026-07-01 < since, should be excluded
      const caseResources = result.resources.filter((r) => r.type === 'case');
      expect(caseResources).toHaveLength(1);
    });

    it('should generate manifest with no cases or models', async () => {
      (caseRepo.find as jest.Mock).mockResolvedValue([]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(1);

      expect(result.is_full).toBe(true);
      // Should still have config resources
      const configResources = result.resources.filter((r) => r.type === 'config');
      expect(configResources.length).toBeGreaterThanOrEqual(2);
    });

    it('should include store-specific service config URL', async () => {
      (caseRepo.find as jest.Mock).mockResolvedValue([]);
      (carModelRepo.find as jest.Mock).mockResolvedValue([]);
      (colorSwatchRepo.find as jest.Mock).mockResolvedValue([]);
      (colorBrandRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.generate(42);

      const serviceConfig = result.resources.find((r) => r.key === 'config:service_types');
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig!.url).toBe('/api/v1/stores/42/service-config');
    });
  });
});
