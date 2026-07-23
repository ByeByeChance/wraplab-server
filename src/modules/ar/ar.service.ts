import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Configuration } from '../configuration/entities/configuration.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';

export interface ArTextureData {
  configuration_id: number;
  model_id: number;
  ar_model_url: string | null;
  tracking_type: string;
  dimensions: {
    length_m: number | null;
    width_m: number | null;
    height_m: number | null;
  };
  colors: { part_code: string; hex: string }[];
}

export interface ArModelConfig {
  model_id: number;
  ar_model_url: string | null;
  tracking_type: string;
  dimensions: {
    length_m: number | null;
    width_m: number | null;
    height_m: number | null;
  };
}

@Injectable()
export class ArService {
  constructor(
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
    @InjectRepository(CarModel)
    private readonly modelRepo: Repository<CarModel>,
  ) {}

  async getArTexture(configId: number): Promise<ArTextureData> {
    const storeId = StoreContext.getStoreId() as number;

    const config = await this.configRepo.findOne({
      where: { id: configId, store_id: storeId, deleted_at: IsNull() },
      relations: ['model', 'partColors', 'partColors.colorSwatch'],
    });

    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    const model = config.model as CarModel | undefined;
    const colors = (config.partColors ?? []).map((pc) => ({
      part_code: pc.part_code,
      hex: pc.colorSwatch?.hex ?? '#FFFFFF',
    }));

    return {
      configuration_id: config.id,
      model_id: config.model_id,
      ar_model_url: model?.model_3d_url ?? null,
      tracking_type: 'plane_detection',
      // TODO: Populate dimensions from CarModel entity once the length_m/width_m/height_m
      // columns exist on the car_model table. Currently these are always null.
      dimensions: {
        length_m: null,
        width_m: null,
        height_m: null,
      },
      colors,
    };
  }

  async getArConfig(modelId: number): Promise<ArModelConfig> {
    const model = await this.modelRepo.findOne({
      where: { id: modelId, deleted_at: IsNull() },
    });

    if (!model) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '车型不存在');
    }

    return {
      model_id: model.id,
      ar_model_url: model.model_3d_url,
      tracking_type: 'plane_detection',
      // TODO: Populate from CarModel entity once dimension columns exist.
      dimensions: {
        length_m: null,
        width_m: null,
        height_m: null,
      },
    };
  }
}
