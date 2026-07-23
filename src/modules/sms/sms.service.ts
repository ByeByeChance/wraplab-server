import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, MoreThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import { SmsCode } from './entities/sms-code.entity';
import { ISmsProvider } from './interfaces/sms-provider.interface';
import { SendSmsCodeDto } from './dto/send-sms-code.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectRepository(SmsCode)
    private readonly smsCodeRepo: Repository<SmsCode>,
    @Inject('ISmsProvider')
    private readonly smsProvider: ISmsProvider,
    private readonly queueService: QueueService,
  ) {}

  async sendCode(dto: SendSmsCodeDto): Promise<{ expires_at: string }> {
    // Rate limit: 60s per phone
    const recentCode = await this.smsCodeRepo.findOne({
      where: {
        phone: dto.phone,
        type: dto.type,
        created_at: MoreThan(new Date(Date.now() - 60000)),
      },
      order: { created_at: 'DESC' },
    });

    if (recentCode) {
      throw new BusinessException(ErrorCode.SMS_RATE_LIMITED, '验证码发送过于频繁，请 60 秒后再试');
    }

    // Daily limit: 10 per phone per day
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dailyCount = await this.smsCodeRepo.count({
      where: {
        phone: dto.phone,
        created_at: MoreThanOrEqual(dayStart),
      },
    });

    if (dailyCount >= 10) {
      throw new BusinessException(ErrorCode.SMS_RATE_LIMITED, '今日验证码发送次数已达上限');
    }

    // Generate 6-digit code using cryptographically secure random
    const code = String(crypto.randomInt(100000, 999999));

    // Set expiration: 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save code record
    const smsCode = this.smsCodeRepo.create({
      phone: dto.phone,
      code,
      type: dto.type,
      expires_at: expiresAt,
      used: 0,
    });

    await this.smsCodeRepo.save(smsCode);

    // Enqueue SMS send via BullMQ (error handling & retry handled by processor)
    await this.queueService.add('notification', 'send-sms', {
      phone: dto.phone,
      code,
      type: dto.type,
    });

    return { expires_at: expiresAt.toISOString() };
  }

  async verifyCode(phone: string, code: string, type: 'login' | 'verify' | 'appointment'): Promise<boolean> {
    // Atomic UPDATE: mark as used only if currently unused and not expired
    const result = await this.smsCodeRepo.update(
      {
        phone,
        type,
        used: 0,
        expires_at: MoreThan(new Date()),
      },
      { used: 1 },
    );

    if (!result.affected || result.affected === 0) {
      throw new BusinessException(ErrorCode.SMS_CODE_INVALID, '验证码错误或已失效');
    }

    // Verify the code itself matches (fetch the record we just marked)
    const smsCode = await this.smsCodeRepo.findOne({
      where: { phone, type, used: 1, expires_at: MoreThan(new Date()) },
      order: { created_at: 'DESC' },
    });

    if (!smsCode || smsCode.code !== code) {
      throw new BusinessException(ErrorCode.SMS_CODE_INVALID, '验证码错误或已失效');
    }

    return true;
  }
}
