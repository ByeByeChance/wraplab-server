import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsCleanupTask } from './sms-cleanup.task';
import { SmsCode } from './entities/sms-code.entity';
import { AliyunSmsProvider } from './adapters/aliyun-sms.provider';
import { TencentSmsProvider } from './adapters/tencent-sms.provider';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([SmsCode]), forwardRef(() => QueueModule)],
  controllers: [SmsController],
  providers: [
    SmsService,
    SmsCleanupTask,
    {
      provide: 'ISmsProvider',
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('SMS_PROVIDER') ?? process.env.SMS_PROVIDER ?? 'aliyun';
        return provider === 'tencent' ? new TencentSmsProvider() : new AliyunSmsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}
