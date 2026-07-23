import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiGeneration } from '../../ai/entities/ai-generation.entity';
import { IAiProvider } from '../../ai/interfaces/ai-provider.interface';

@Processor('ai-generation', { concurrency: 3 })
@Injectable()
export class AiGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGenerationProcessor.name);

  constructor(
    @InjectRepository(AiGeneration)
    private readonly generationRepo: Repository<AiGeneration>,
    @Inject('IAiProvider')
    private readonly aiProvider: IAiProvider,
  ) {
    super();
  }

  async process(job: Job<{ generationId: number }>, _token?: string): Promise<void> {
    const { generationId } = job.data;

    const generation = await this.generationRepo.findOne({ where: { id: generationId } });
    if (!generation) {
      this.logger.error(`AiGeneration ${generationId} not found, skipping job`);
      return;
    }

    // Update status to processing
    await this.generationRepo.update(generationId, { status: 'processing' } as Partial<AiGeneration>);
    this.logger.log(`Processing AI generation ${generationId}, attempt ${job.attemptsMade + 1}`);

    // Set timeout
    const timeoutMs = parseInt(process.env.AI_GENERATION_TIMEOUT_MS || '300000', 10);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out')), timeoutMs),
    );

    try {
      const result = await Promise.race([
        this.aiProvider.generateImage({
          prompt: generation.prompt_text,
          style: generation.style,
        }),
        timeout,
      ]);

      if (result.status === 'completed') {
        await this.generationRepo.update(generationId, {
          status: 'completed',
          result_image_url: result.imageUrl,
        } as Partial<AiGeneration>);
        this.logger.log(`AI generation ${generationId} completed successfully`);
      } else {
        throw new Error(result.errorMessage || 'AI generation returned failed status');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`AI generation ${generationId} failed (attempt ${job.attemptsMade + 1}): ${err.message}`);
      await this.generationRepo.update(generationId, {
        status: 'failed',
        error_message: err.message,
        retry_count: job.attemptsMade + 1,
      } as Partial<AiGeneration>);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }
}
