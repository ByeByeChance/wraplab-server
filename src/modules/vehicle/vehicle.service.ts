import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { CACHE_TTL } from '../../common/decorators/cache.decorator';
import { CarBrand } from './entities/car-brand.entity';
import { CarSeries } from './entities/car-series.entity';
import { CarModel } from './entities/car-model.entity';
import { CarPart } from './entities/car-part.entity';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import { CreateSeriesDto, UpdateSeriesDto } from './dto/create-series.dto';
import { CreateModelDto, UpdateModelDto } from './dto/create-model.dto';
import { PartAreaItem } from './dto/part-area.dto';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(CarBrand)
    private readonly brandRepo: Repository<CarBrand>,
    @InjectRepository(CarSeries)
    private readonly seriesRepo: Repository<CarSeries>,
    @InjectRepository(CarModel)
    private readonly modelRepo: Repository<CarModel>,
    @InjectRepository(CarPart)
    private readonly carPartRepo: Repository<CarPart>,
    private readonly redisService: RedisService,
  ) {}

  // --- Public read ---

  async getBrands(): Promise<CarBrand[]> {
    const cacheKey = 'vehicles:brands:list';
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.brandRepo.find({
      where: { deleted_at: IsNull() },
      order: { sort_order: 'DESC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.VEHICLES, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async getSeries(brandId: number): Promise<CarSeries[]> {
    const cacheKey = `vehicles:series:brand_${brandId}`;
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.seriesRepo.find({
      where: { brand_id: brandId, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.VEHICLES, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async getModels(seriesId: number): Promise<CarModel[]> {
    const cacheKey = `vehicles:models:series_${seriesId}`;
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.modelRepo.find({
      where: { series_id: seriesId, deleted_at: IsNull() },
      order: { year: 'DESC', name: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.VEHICLES, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async getModelById(id: number): Promise<CarModel | null> {
    const cacheKey = `vehicles:model:${id}`;
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.modelRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['series', 'series.brand'],
    });

    if (result) {
      try {
        await this.redisService.getClient().setex(cacheKey, CACHE_TTL.VEHICLES, JSON.stringify(result));
      } catch { /* cache write failed, ignore */ }
    }

    return result;
  }

  // --- Admin CRUD: Brands ---

  async createBrand(dto: CreateBrandDto): Promise<CarBrand> {
    const brand = this.brandRepo.create(dto);
    const result = await this.brandRepo.save(brand);
    await this.invalidateVehicleCache();
    return result;
  }

  async updateBrand(id: number, dto: UpdateBrandDto): Promise<CarBrand> {
    await this.brandRepo.update(id, dto);
    const result = await this.brandRepo.findOneByOrFail({ id });
    await this.invalidateVehicleCache();
    return result;
  }

  async deleteBrand(id: number): Promise<void> {
    await this.brandRepo.update(id, { deleted_at: new Date() } as Partial<CarBrand>);
    await this.invalidateVehicleCache();
  }

  // --- Admin CRUD: Series ---

  async createSeries(dto: CreateSeriesDto): Promise<CarSeries> {
    const series = this.seriesRepo.create(dto);
    const result = await this.seriesRepo.save(series);
    await this.invalidateVehicleCache();
    return result;
  }

  async updateSeries(id: number, dto: UpdateSeriesDto): Promise<CarSeries> {
    await this.seriesRepo.update(id, dto);
    const result = await this.seriesRepo.findOneByOrFail({ id });
    await this.invalidateVehicleCache();
    return result;
  }

  async deleteSeries(id: number): Promise<void> {
    await this.seriesRepo.update(id, { deleted_at: new Date() } as Partial<CarSeries>);
    await this.invalidateVehicleCache();
  }

  // --- Admin CRUD: Models ---

  async createModel(dto: CreateModelDto): Promise<CarModel> {
    const model = this.modelRepo.create(dto);
    const result = await this.modelRepo.save(model);
    await this.invalidateVehicleCache();
    return result;
  }

  async updateModel(id: number, dto: UpdateModelDto): Promise<CarModel> {
    await this.modelRepo.update(id, dto);
    const result = await this.modelRepo.findOneByOrFail({ id });
    await this.invalidateVehicleCache();
    return result;
  }

  async deleteModel(id: number): Promise<void> {
    await this.modelRepo.update(id, { deleted_at: new Date() } as Partial<CarModel>);
    await this.invalidateVehicleCache();
  }

  // --- Part Area Management ---

  async getPartAreas(modelId: number): Promise<CarPart[]> {
    const cacheKey = `vehicles:parts:model_${modelId}`;
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss, fall through */ }

    const result = await this.carPartRepo.find({
      where: { model_id: modelId },
      order: { part_code: 'ASC' },
    });

    try {
      await this.redisService.getClient().setex(cacheKey, CACHE_TTL.VEHICLES, JSON.stringify(result));
    } catch { /* cache write failed, ignore */ }

    return result;
  }

  async batchUpdatePartAreas(modelId: number, parts: PartAreaItem[]): Promise<CarPart[]> {
    const results: CarPart[] = [];

    for (const item of parts) {
      // Upsert: update existing or create new
      const existing = await this.carPartRepo.findOne({
        where: { model_id: modelId, part_code: item.part_code },
      });

      if (existing) {
        existing.area_m2 = item.area_m2;
        results.push(await this.carPartRepo.save(existing));
      } else {
        const part = this.carPartRepo.create({
          model_id: modelId,
          part_code: item.part_code,
          area_m2: item.area_m2,
        });
        results.push(await this.carPartRepo.save(part));
      }
    }

    await this.invalidateVehicleCache();
    return results;
  }

  async copyPartAreas(modelId: number, templateModelId: number): Promise<CarPart[]> {
    const templateParts = await this.carPartRepo.find({
      where: { model_id: templateModelId },
    });

    if (templateParts.length === 0) {
      return [];
    }

    const results: CarPart[] = [];

    for (const template of templateParts) {
      const existing = await this.carPartRepo.findOne({
        where: { model_id: modelId, part_code: template.part_code },
      });

      if (existing) {
        existing.area_m2 = template.area_m2;
        results.push(await this.carPartRepo.save(existing));
      } else {
        const part = this.carPartRepo.create({
          model_id: modelId,
          part_code: template.part_code,
          area_m2: template.area_m2,
        });
        results.push(await this.carPartRepo.save(part));
      }
    }

    await this.invalidateVehicleCache();
    return results;
  }

  async getPartAreaSummary(modelId: number): Promise<{
    model_id: number;
    total_area_m2: number;
    parts: { part_code: string; area_m2: number }[];
  }> {
    const parts = await this.carPartRepo.find({
      where: { model_id: modelId },
      order: { part_code: 'ASC' },
    });

    const totalArea = parts.reduce((sum, p) => sum + Number(p.area_m2), 0);

    return {
      model_id: modelId,
      total_area_m2: Math.round(totalArea * 10000) / 10000,
      parts: parts.map((p) => ({
        part_code: p.part_code,
        area_m2: Number(p.area_m2),
      })),
    };
  }

  // --- Cache invalidation ---

  private async invalidateVehicleCache(): Promise<void> {
    try {
      const keys = await this.redisService.getClient().keys('vehicles:*');
      if (keys.length > 0) {
        await this.redisService.getClient().del(...keys);
      }
    } catch { /* redis error, ignore */ }
  }
}
