import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SmsCode } from './entities/sms-code.entity';

@Injectable()
export class SmsCleanupTask {
  private readonly logger = new Logger(SmsCleanupTask.name);

  constructor(
    @InjectRepository(SmsCode)
    private readonly smsCodeRepo: Repository<SmsCode>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await this.smsCodeRepo.delete({
        expires_at: LessThan(new Date()),
      });
      if ((result.affected ?? 0) > 0) {
        this.logger.log(`Cleaned up ${result.affected} expired SMS codes`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to clean up expired SMS codes: ${err.message}`, err.stack);
    }
  }
}
