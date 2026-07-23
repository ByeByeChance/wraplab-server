import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ColorService } from './color.service';
import { ColorBrand } from './entities/color-brand.entity';
import { ColorSwatch } from './entities/color-swatch.entity';
import { Material } from './entities/material.entity';
import { RedisService } from '../redis/redis.service';

describe('ColorService', () => {
  let service: ColorService;

  const mockBrandRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mockSwatchRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const mockMaterialRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColorService,
        { provide: getRepositoryToken(ColorBrand), useValue: mockBrandRepo },
        { provide: getRepositoryToken(ColorSwatch), useValue: mockSwatchRepo },
        { provide: getRepositoryToken(Material), useValue: mockMaterialRepo },
        {
          provide: RedisService,
          useValue: { getClient: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() }) },
        },
      ],
    }).compile();

    service = module.get<ColorService>(ColorService);
  });

  it('should return color brands', async () => {
    const brands = [{ id: 1, name: 'AX' } as ColorBrand];
    mockBrandRepo.find.mockResolvedValue(brands);
    const result = await service.getColorBrands();
    expect(result).toEqual(brands);
  });

  it('should return swatches filtered by brandId', async () => {
    const swatches = [{ id: 1, name: '超亮金属黄', brand_id: 1 } as ColorSwatch];
    mockSwatchRepo.find.mockResolvedValue(swatches);
    const result = await service.getSwatches(1);
    expect(result).toEqual(swatches);
  });

  it('should return materials', async () => {
    const materials = [{ id: 1, name: '哑光', price_multiplier: 1.0 } as Material];
    mockMaterialRepo.find.mockResolvedValue(materials);
    const result = await service.getMaterials();
    expect(result).toEqual(materials);
  });
});
