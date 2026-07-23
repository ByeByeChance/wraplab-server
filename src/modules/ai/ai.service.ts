import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';
import { randomUUID } from 'crypto';
import { AiGeneration } from './entities/ai-generation.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { CarSeries } from '../vehicle/entities/car-series.entity';
import { CarBrand } from '../vehicle/entities/car-brand.entity';
import { IAiProvider } from './interfaces/ai-provider.interface';
import { GenerateImageDto } from './dto/generate-image.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiGeneration)
    private readonly generationRepo: Repository<AiGeneration>,
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
    @Inject('IAiProvider')
    private readonly aiProvider: IAiProvider,
    private readonly queueService: QueueService,
  ) {}

  async generateImage(
    configId: number,
    dto: GenerateImageDto,
  ): Promise<{ generation_id: number; status: string; queue_position?: number; estimated_seconds?: number }> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    // Validate configuration belongs to this store
    const config = await this.configRepo.findOne({
      where: { id: configId, store_id: storeId, deleted_at: IsNull() },
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
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    // Check monthly quota
    const monthlyQuota = parseInt(process.env.AI_GENERATION_MONTHLY_QUOTA || '100', 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyCount = await this.generationRepo.count({
      where: {
        store_id: storeId,
        created_at: MoreThanOrEqual(monthStart),
      },
    });

    if (monthlyCount >= monthlyQuota) {
      throw new BusinessException(ErrorCode.AI_GENERATION_QUOTA_EXCEEDED, '本月 AI 生图次数已用完');
    }

    // Assemble prompt
    const promptText = this.assemblePrompt(config, dto);

    // Check queue size limit and insert atomically within a transaction
    const maxQueueSize = parseInt(process.env.AI_QUEUE_MAX_WAITING || '500', 10);
    const { saved, queuePosition } = await this.generationRepo.manager.transaction(async (manager) => {
      const queueCount = await manager.count(AiGeneration, {
        where: { status: 'queued' },
      });
      if (queueCount >= maxQueueSize) {
        throw new BusinessException(ErrorCode.AI_QUEUE_FULL, 'AI生图队列已满，请稍后再试');
      }

      const generation = manager.create(AiGeneration, {
        store_id: storeId,
        configuration_id: configId,
        prompt_text: promptText,
        style: dto.style,
        status: 'queued',
        staff_id: staffId,
        queue_position: queueCount + 1,
        job_id: this.generateJobId(),
      });

      const savedGen = await manager.save(generation);
      return { saved: savedGen, queuePosition: queueCount + 1 };
    });

    // Enqueue AI generation job via BullMQ
    await this.queueService.add('ai-generation', 'generate', { generationId: saved.id });

    return {
      generation_id: saved.id,
      status: 'queued',
      queue_position: queuePosition,
      estimated_seconds: (queuePosition - 1) * 30,
    };
  }

  async getQueueStatus(generationId: number): Promise<{
    generation_id: number;
    status: string;
    queue_position: number | null;
    result_image_url: string | null;
  }> {
    const generation = await this.generationRepo.findOne({
      where: { id: generationId },
    });

    if (!generation) {
      throw new BusinessException(ErrorCode.GENERATION_NOT_FOUND, '生图任务不存在');
    }

    // Calculate current queue position
    let currentPosition: number | null = null;
    if (generation.status === 'queued') {
      await this.generationRepo.count({
        where: {
          status: 'queued',
          created_at: new Date(generation.created_at.getTime()) as unknown as Date,
        },
      });
      // Count those created before this one
      const countBefore = await this.generationRepo
        .createQueryBuilder('g')
        .where('g.status = :status', { status: 'queued' })
        .andWhere('g.created_at < :createdAt', { createdAt: generation.created_at })
        .getCount();
      currentPosition = countBefore + 1;
    }

    return {
      generation_id: generation.id,
      status: generation.status,
      queue_position: currentPosition,
      result_image_url: generation.result_image_url,
    };
  }

  async getQueueStats(): Promise<{
    total_queued: number;
    total_processing: number;
    total_completed_today: number;
    total_failed_today: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [queued, processing, completedToday, failedToday] = await Promise.all([
      this.generationRepo.count({ where: { status: 'queued' } }),
      this.generationRepo.count({ where: { status: 'processing' } }),
      this.generationRepo.count({
        where: {
          status: 'completed',
          updated_at: MoreThanOrEqual(today) as unknown as Date,
        },
      }),
      this.generationRepo.count({
        where: {
          status: 'failed',
          updated_at: MoreThanOrEqual(today) as unknown as Date,
        },
      }),
    ]);

    return {
      total_queued: queued,
      total_processing: processing,
      total_completed_today: completedToday,
      total_failed_today: failedToday,
    };
  }

  private generateJobId(): string {
    return randomUUID();
  }

  async findOne(id: number): Promise<AiGeneration> {
    const generation = await this.generationRepo.findOne({
      where: { id },
      relations: ['configuration'],
    });

    if (!generation) {
      throw new BusinessException(ErrorCode.GENERATION_NOT_FOUND, '生图任务不存在');
    }

    return generation;
  }

  async findByConfigId(configId: number): Promise<AiGeneration[]> {
    return this.generationRepo.find({
      where: { configuration_id: configId },
      order: { created_at: 'DESC' },
    });
  }

  async handleCallback(dto: {
    generation_id: number;
    status: 'completed' | 'failed';
    result_image_url?: string;
    error_message?: string;
  }): Promise<void> {
    const storeId = StoreContext.getStoreId();

    const generation = await this.generationRepo.findOne({
      where: { id: dto.generation_id },
    });

    if (!generation) {
      throw new BusinessException(ErrorCode.GENERATION_NOT_FOUND, '生图任务不存在');
    }

    // Verify store ownership
    if (storeId != null && generation.store_id !== storeId) {
      throw new BusinessException(ErrorCode.FORBIDDEN, '无权操作该生图任务');
    }

    // Only update if still pending or processing to prevent overwriting final states
    const allowedStatuses = new Set(['pending', 'processing']);
    if (!allowedStatuses.has(generation.status)) {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, '该生图任务已完成，无法更新');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.status === 'completed') {
      updateData.status = 'completed';
      updateData.result_image_url = dto.result_image_url ?? null;
    } else {
      updateData.status = 'failed';
      updateData.error_message = dto.error_message ?? 'AI service returned failed status';
    }

    await this.generationRepo.update(dto.generation_id, updateData);
  }

  private assemblePrompt(config: Configuration, dto: GenerateImageDto): string {
    const model = config.model as CarModel | undefined;
    const series = model?.series as CarSeries | undefined;
    const brand = series?.brand as CarBrand | undefined;

    const brandName = brand?.name ?? '';
    const seriesName = series?.name ?? '';
    const modelName = model?.name ?? '';

    const partColors = config.partColors ?? [];
    const firstPartColor = partColors[0];
    const colorName = firstPartColor?.colorSwatch?.name ?? '';
    const materialName = firstPartColor?.material?.name ?? '';
    const materialPrompt = materialName === '亮面' ? 'glossy finish' : 'matte finish';

    const basePrompt = `A ${brandName} ${seriesName} ${modelName} with ${colorName} car wrap`;

    const stylePresets: Record<string, string> = {
      scene: 'parked on a city street, natural lighting, photorealistic, 8k',
      studio: 'studio lighting, white background, product photography, 8k',
      outdoor: 'outdoor scenic mountain road, golden hour lighting, photorealistic, 8k',
    };

    let prompt = `${basePrompt}, ${materialPrompt}, ${stylePresets[dto.style]}`;

    if (dto.custom_prompt) {
      prompt += `, ${dto.custom_prompt}`;
    }

    return prompt;
  }
}
