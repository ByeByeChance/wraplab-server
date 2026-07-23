import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { CACHE_TTL } from '../../common/decorators/cache.decorator';
import { ColorBrand } from './entities/color-brand.entity';
import { ColorSwatch } from './entities/color-swatch.entity';
import { Material } from './entities/material.entity';
import { CreateColorBrandDto, UpdateColorBrandDto } from './dto/create-color-brand.dto';
import { CreateColorSwatchDto, UpdateColorSwatchDto } from './dto/create-color-swatch.dto';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';

@Injectable()
export class ColorService {
  constructor(
    @InjectRepository(ColorBrand)
    private readonly colorBrandRepo: Repository<ColorBrand>,
    @InjectRepository(ColorSwatch)
    private readonly colorSwatchRepo: Repository<ColorSwatch>,
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
    private readonly redisService: RedisService,
  ) {}

  // --- Public read ---

  async getColorBrands(): Promise<ColorBrand[]> {
    const cacheKey = 'colors:brands:list';
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.colorBrandRepo.find({
      where: { deleted_at: IsNull() },
      order: { name: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.COLORS, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async getSwatches(brandId: number): Promise<ColorSwatch[]> {
    const cacheKey = `colors:swatches:brand_${brandId}`;
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.colorSwatchRepo.find({
      where: { brand_id: brandId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.COLORS, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async getMaterials(): Promise<Material[]> {
    const cacheKey = 'colors:materials:list';
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.materialRepo.find({
      where: { deleted_at: IsNull() },
      order: { name: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.COLORS, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  // --- Admin CRUD: Color Brands ---

  async createColorBrand(dto: CreateColorBrandDto): Promise<ColorBrand> {
    const brand = this.colorBrandRepo.create(dto);
    const result = await this.colorBrandRepo.save(brand);
    await this.invalidateColorCache();
    return result;
  }

  async updateColorBrand(id: number, dto: UpdateColorBrandDto): Promise<ColorBrand> {
    await this.colorBrandRepo.update(id, dto);
    const result = await this.colorBrandRepo.findOneByOrFail({ id });
    await this.invalidateColorCache();
    return result;
  }

  async deleteColorBrand(id: number): Promise<void> {
    await this.colorBrandRepo.update(id, { deleted_at: new Date() } as Partial<ColorBrand>);
    await this.invalidateColorCache();
  }

  // --- Admin CRUD: Color Swatches ---

  async createColorSwatch(dto: CreateColorSwatchDto): Promise<ColorSwatch> {
    const swatch = this.colorSwatchRepo.create(dto);
    const result = await this.colorSwatchRepo.save(swatch);
    await this.invalidateColorCache();
    return result;
  }

  async updateColorSwatch(id: number, dto: UpdateColorSwatchDto): Promise<ColorSwatch> {
    await this.colorSwatchRepo.update(id, dto);
    const result = await this.colorSwatchRepo.findOneByOrFail({ id });
    await this.invalidateColorCache();
    return result;
  }

  async deleteColorSwatch(id: number): Promise<void> {
    await this.colorSwatchRepo.update(id, { deleted_at: new Date() } as Partial<ColorSwatch>);
    await this.invalidateColorCache();
  }

  // --- Admin CRUD: Materials ---

  async createMaterial(dto: CreateMaterialDto): Promise<Material> {
    const material = this.materialRepo.create(dto);
    const result = await this.materialRepo.save(material);
    await this.invalidateColorCache();
    return result;
  }

  async updateMaterial(id: number, dto: UpdateMaterialDto): Promise<Material> {
    await this.materialRepo.update(id, dto);
    const result = await this.materialRepo.findOneByOrFail({ id });
    await this.invalidateColorCache();
    return result;
  }

  async deleteMaterial(id: number): Promise<void> {
    await this.materialRepo.update(id, { deleted_at: new Date() } as Partial<Material>);
    await this.invalidateColorCache();
  }

  // --- Cache invalidation ---

  private async invalidateColorCache(): Promise<void> {
    try {
      const keys = await this.redisService.getClient().keys('colors:*');
      if (keys.length > 0) {
        await this.redisService.getClient().del(...keys);
      }
    } catch { /* redis error, ignore */ }
  }
}
