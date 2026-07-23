import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Configuration } from './entities/configuration.entity';
import { PartColor } from './entities/part-color.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';
import { Material } from '../color/entities/material.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateConfigurationDto, UpdateConfigurationDto } from './dto/create-configuration.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ConfigurationService {
  constructor(
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
    @InjectRepository(PartColor)
    private readonly partColorRepo: Repository<PartColor>,
    @InjectRepository(CarModel)
    private readonly modelRepo: Repository<CarModel>,
    @InjectRepository(ColorSwatch)
    private readonly swatchRepo: Repository<ColorSwatch>,
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
  ) {}

  async create(dto: CreateConfigurationDto): Promise<Configuration> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    // Validate referenced entities exist
    const model = await this.modelRepo.findOne({ where: { id: dto.model_id, deleted_at: IsNull() } });
    if (!model) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '车型不存在');
    }

    const swatch = await this.swatchRepo.findOne({ where: { id: dto.color_swatch_id, deleted_at: IsNull() } });
    if (!swatch) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '颜色不存在');
    }

    const material = await this.materialRepo.findOne({ where: { id: dto.material_id, deleted_at: IsNull() } });
    if (!material) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '材质不存在');
    }

    const configuration = this.configRepo.create({
      store_id: storeId,
      model_id: dto.model_id,
      name: dto.name ?? null,
      note: sanitizeText(dto.note),
      customer_name: sanitizeText(dto.customer_name),
      customer_phone: dto.customer_phone ?? null,
      status: 'draft',
      staff_id: staffId,
    });

    const savedConfig = await this.configRepo.save(configuration);

    // Auto-create FULL part_color record
    const partColor = this.partColorRepo.create({
      store_id: storeId,
      configuration_id: savedConfig.id,
      part_code: 'FULL',
      color_swatch_id: dto.color_swatch_id,
      material_id: dto.material_id,
    });
    await this.partColorRepo.save(partColor);

    return (await this.findById(savedConfig.id))!;
  }

  async findAll(
    pagination: PaginationDto,
    status?: string,
  ): Promise<{ list: Configuration[]; total: number; page: number; size: number }> {
    const storeId = StoreContext.getStoreId() as number;
    const where: Record<string, unknown> = { store_id: storeId, deleted_at: IsNull() };
    if (status) {
      where.status = status;
    }

    const [list, total] = await this.configRepo.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
      relations: ['model'],
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async findById(id: number): Promise<Configuration | null> {
    const storeId = StoreContext.getStoreId();
    const isAdmin = StoreContext.isAdmin();

    const where: Record<string, unknown> = { id, deleted_at: IsNull() };
    // Non-admin: filter by store_id
    if (!(isAdmin && storeId === null)) {
      where.store_id = storeId as number;
    }

    const config = await this.configRepo.findOne({
      where,
      relations: [
        'model',
        'model.series',
        'model.series.brand',
        'partColors',
        'partColors.colorSwatch',
        'partColors.material',
      ],
    });

    if (!config) {
      // Return 404 to not expose that resource belongs to another store
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    return config;
  }

  async update(id: number, dto: UpdateConfigurationDto): Promise<Configuration> {
    const config = await this.findById(id);
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    // Validate referenced entities if provided
    if (dto.color_swatch_id) {
      const swatch = await this.swatchRepo.findOne({ where: { id: dto.color_swatch_id, deleted_at: IsNull() } });
      if (!swatch) {
        throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '颜色不存在');
      }
    }

    if (dto.material_id) {
      const material = await this.materialRepo.findOne({ where: { id: dto.material_id, deleted_at: IsNull() } });
      if (!material) {
        throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '材质不存在');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.note !== undefined) updateData.note = sanitizeText(dto.note);
    if (dto.customer_name !== undefined) updateData.customer_name = sanitizeText(dto.customer_name);
    if (dto.customer_phone !== undefined) updateData.customer_phone = dto.customer_phone;

    await this.configRepo.update(id, updateData);

    // Update part_color if color or material changed
    if (dto.color_swatch_id || dto.material_id) {
      const partColorUpdate: Record<string, unknown> = {};
      if (dto.color_swatch_id) partColorUpdate.color_swatch_id = dto.color_swatch_id;
      if (dto.material_id) partColorUpdate.material_id = dto.material_id;
      await this.partColorRepo.update(
        { configuration_id: id, part_code: 'FULL', deleted_at: IsNull() },
        partColorUpdate,
      );
    }

    return (await this.findById(id))!;
  }

  async updatePartColor(configId: number, partCode: string, colorSwatchId: number, materialId: number): Promise<void> {
    const config = await this.findById(configId);
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    const existing = await this.partColorRepo.findOne({
      where: { configuration_id: configId, part_code: partCode, deleted_at: IsNull() },
    });

    if (existing) {
      await this.partColorRepo.update(existing.id, {
        color_swatch_id: colorSwatchId,
        material_id: materialId,
      });
    } else {
      const storeId = StoreContext.getStoreId() as number;
      const partColor = this.partColorRepo.create({
        store_id: storeId,
        configuration_id: configId,
        part_code: partCode,
        color_swatch_id: colorSwatchId,
        material_id: materialId,
      });
      await this.partColorRepo.save(partColor);
    }
  }

  async updateAllPartMaterials(configId: number, materialId: number): Promise<void> {
    const config = await this.findById(configId);
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    await this.partColorRepo.update({ configuration_id: configId, deleted_at: IsNull() }, { material_id: materialId });
  }

  async delete(id: number): Promise<void> {
    const config = await this.findById(id);
    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    const now = new Date();
    // Soft delete configuration and its part_colors
    await this.configRepo.update(id, { deleted_at: now } as Partial<Configuration>);
    await this.partColorRepo.update({ configuration_id: id, deleted_at: IsNull() }, {
      deleted_at: now,
    } as Partial<PartColor>);
  }
}
