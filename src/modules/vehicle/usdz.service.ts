import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CarModel } from './entities/car-model.entity';
import { UsdzConversionLog } from './entities/usdz-conversion-log.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

@Injectable()
export class UsdzService {
  private readonly logger = new Logger(UsdzService.name);

  constructor(
    @InjectRepository(CarModel)
    private readonly carModelRepo: Repository<CarModel>,
    @InjectRepository(UsdzConversionLog)
    private readonly usdzLogRepo: Repository<UsdzConversionLog>,
  ) {}

  async generate(modelId: number): Promise<{ status: string; model_id: number }> {
    const model = await this.carModelRepo.findOne({
      where: { id: modelId, deleted_at: IsNull() },
    });
    if (!model) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '车型不存在');
    }

    // Validate 3D model exists
    if (!model.model_3d_url) {
      throw new BusinessException(ErrorCode.MODEL_NOT_CONFIGURED, '该车型未配置 3D 模型，无法生成 USDZ');
    }

    // Check if USDZ already exists
    if (model.usdz_url) {
      throw new BusinessException(ErrorCode.USDZ_ALREADY_EXISTS, '该车型已有USDZ文件');
    }

    // Check for existing processing log
    const existingProcessing = await this.usdzLogRepo.findOne({
      where: { model_id: modelId, status: 'processing' },
    });
    if (existingProcessing) {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, '该车型 USDZ 转换正在进行中');
    }

    // Create conversion log
    const log = this.usdzLogRepo.create({
      model_id: modelId,
      status: 'processing',
    });
    await this.usdzLogRepo.save(log);

    // In production, here we'd submit to a Bull queue for async processing.
    // For Phase 5, we simulate the queued status.
    this.logger.log(`USDZ conversion queued for model ${modelId}`);

    return { status: 'queued', model_id: modelId };
  }

  async getInfo(modelId: number): Promise<{ usdz_url: string | null; available: boolean }> {
    const model = await this.carModelRepo.findOne({
      where: { id: modelId, deleted_at: IsNull() },
    });

    if (!model) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '车型不存在');
    }

    return {
      usdz_url: model.usdz_url ?? null,
      available: !!model.usdz_url,
    };
  }
}
