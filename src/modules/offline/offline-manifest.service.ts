import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Case } from '../case/entities/case.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorBrand } from '../color/entities/color-brand.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';
import { CachedResourceDto } from './dto/offline-manifest.dto';

@Injectable()
export class OfflineManifestService {
  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    @InjectRepository(CarModel)
    private readonly carModelRepo: Repository<CarModel>,
    @InjectRepository(ColorSwatch)
    private readonly colorSwatchRepo: Repository<ColorSwatch>,
    @InjectRepository(ColorBrand)
    private readonly colorBrandRepo: Repository<ColorBrand>,
  ) {}

  async generate(
    storeId: number,
    since?: string,
  ): Promise<{ resources: CachedResourceDto[]; generated_at: string; is_full: boolean }> {
    const allResources: CachedResourceDto[] = [];

    // a. Popular cases (top 50)
    const cases = await this.caseRepo.find({
      where: { status: 'published', deleted_at: IsNull() },
      order: { like_count: 'DESC', view_count: 'DESC' },
      take: 50,
    });

    const caseResources: CachedResourceDto[] = cases
      .filter((c) => c.cover_image_url)
      .map((c) => ({
        key: `case:${c.id}:cover`,
        type: 'case' as const,
        url: c.cover_image_url!,
        version: c.updated_at.toISOString(),
        ttl_seconds: 86400,
      }));
    allResources.push(...caseResources);

    // b. Vehicle models
    const models = await this.carModelRepo.find({
      where: { deleted_at: IsNull() },
      take: 100,
    });

    const modelResources: CachedResourceDto[] = models
      .filter((m) => m.model_3d_url)
      .map((m) => ({
        key: `vehicle:model:${m.id}`,
        type: 'vehicle' as const,
        url: m.model_3d_url!,
        version: m.updated_at?.toISOString() ?? new Date().toISOString(),
        ttl_seconds: 604800,
      }));
    allResources.push(...modelResources);

    // c. Color data - json API endpoint rather than image
    const colorResources: CachedResourceDto[] = [
      {
        key: 'config:colors',
        type: 'config' as const,
        url: '/api/v1/colors',
        version: new Date().toISOString(),
        ttl_seconds: 2592000,
      },
    ];
    allResources.push(...colorResources);

    // d. Config resources
    allResources.push({
      key: 'config:service_types',
      type: 'config' as const,
      url: `/api/v1/stores/${storeId}/service-config`,
      version: new Date().toISOString(),
      ttl_seconds: 86400,
    });

    // Incremental filter
    let filteredResources = allResources;
    let isFull = true;

    if (since) {
      const sinceDate = new Date(since);
      filteredResources = allResources.filter((r) => new Date(r.version) > sinceDate);
      isFull = false;
    }

    return {
      resources: filteredResources,
      generated_at: new Date().toISOString(),
      is_full: isFull,
    };
  }
}
