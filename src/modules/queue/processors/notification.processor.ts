import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ISmsProvider } from '../../sms/interfaces/sms-provider.interface';

@Processor('notification', { concurrency: 5 })
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject('ISmsProvider')
    private readonly smsProvider: ISmsProvider,
  ) {
    super();
  }

  async process(job: Job<{ phone: string; code: string; type: 'login' | 'verify' | 'appointment' }>, _token?: string): Promise<void> {
    switch (job.name) {
      case 'send-sms':
        await this.handleSendSms(job);
        break;
      default:
        this.logger.warn(`Unknown notification job: ${job.name}`);
    }
  }

  private async handleSendSms(job: Job<{ phone: string; code: string; type: 'login' | 'verify' | 'appointment' }>): Promise<void> {
    const { phone, code, type } = job.data;
    this.logger.log(`Sending SMS to ${phone}, attempt ${job.attemptsMade + 1}`);
    await this.smsProvider.send({ phone, code, type });
    this.logger.log(`SMS sent successfully to ${phone}`);
  }
}
