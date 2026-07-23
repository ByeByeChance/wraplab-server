import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiWebhookController } from './ai-webhook.controller';
import { AiService } from './ai.service';
import { AiGeneration } from './entities/ai-generation.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { OpenAiProvider } from './adapters/openai.provider';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiGeneration, Configuration]), HttpModule, forwardRef(() => QueueModule)],
  controllers: [AiController, AiWebhookController],
  providers: [
    AiService,
    {
      provide: 'IAiProvider',
      useClass:
        process.env.AI_PROVIDER === 'stable-diffusion'
          ? OpenAiProvider // TODO: Replace with StableDiffusionProvider when implemented
          : OpenAiProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
