import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { AiGenerationProcessor } from './processors/ai-generation.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { AiGeneration } from '../ai/entities/ai-generation.entity';
import { AiModule } from '../ai/ai.module';
import { SmsModule } from '../sms/sms.module';
import { OpenAiProvider } from '../ai/adapters/openai.provider';
import { AliyunSmsProvider } from '../sms/adapters/aliyun-sms.provider';
import { TencentSmsProvider } from '../sms/adapters/tencent-sms.provider';
import { HttpModule } from '@nestjs/axios';

const isTest = process.env.NODE_ENV === 'test';

const bullImports = isTest
  ? []
  : [
      BullModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD', '') || undefined,
            db: config.get<number>('REDIS_DB', 0),
          },
          prefix: config.get<string>('BULLMQ_PREFIX', 'wraplab'),
        }),
      }),
      BullModule.registerQueue(
        { name: 'ai-generation' },
        { name: 'notification' },
        { name: 'scheduled-task' },
      ),
    ];

const bullProviders = isTest
  ? []
  : [AiGenerationProcessor, NotificationProcessor];

@Module({
  imports: [
    ...bullImports,
    HttpModule,
    TypeOrmModule.forFeature([AiGeneration]),
    forwardRef(() => AiModule),
    forwardRef(() => SmsModule),
  ],
  providers: [
    QueueService,
    ...bullProviders,
    {
      provide: 'IAiProvider',
      useFactory: (config: ConfigService, httpService: HttpService) => {
        const provider = config.get<string>('AI_PROVIDER') ?? process.env.AI_PROVIDER ?? 'openai';
        if (provider === 'stable-diffusion') {
          return new OpenAiProvider(httpService);
        }
        return new OpenAiProvider(httpService);
      },
      inject: [ConfigService, HttpService],
    },
    {
      provide: 'ISmsProvider',
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('SMS_PROVIDER') ?? process.env.SMS_PROVIDER ?? 'aliyun';
        return provider === 'tencent' ? new TencentSmsProvider() : new AliyunSmsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: isTest ? [QueueService] : [QueueService, BullModule],
})
export class QueueModule {}
