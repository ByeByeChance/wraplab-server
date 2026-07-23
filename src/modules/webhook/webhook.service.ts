import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { WebhookConfig } from './entities/webhook-config.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { UpdateWebhookConfigDto } from './dto/webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  // In-memory rate limiter (replaced by Redis in production).
  // Uses a sliding-window approach: stores an array of timestamps per key.
  private rateLimitMap = new Map<string, number[]>();

  constructor(
    @InjectRepository(WebhookConfig)
    private readonly webhookConfigRepo: Repository<WebhookConfig>,
  ) {}

  async upsert(dto: UpdateWebhookConfigDto): Promise<WebhookConfig> {
    const storeId = StoreContext.getStoreId() as number;
    this.checkRateLimit(storeId);

    // Validate HTTPS
    if (!dto.url.startsWith('https://')) {
      throw new BusinessException(ErrorCode.WEBHOOK_URL_INVALID, 'Webhook URL必须使用HTTPS协议');
    }

    // Find existing config for this store+type
    const existing = await this.webhookConfigRepo.findOne({
      where: { store_id: storeId, type: dto.type, deleted_at: IsNull() },
    });

    if (existing) {
      existing.url = dto.url;
      existing.events = dto.events;
      existing.status = dto.status ? 1 : 0;
      existing.secret = dto.secret ?? existing.secret;
      return this.webhookConfigRepo.save(existing);
    }

    const config = this.webhookConfigRepo.create({
      store_id: storeId,
      type: dto.type,
      url: dto.url,
      events: dto.events,
      status: dto.status ? 1 : 0,
      secret: dto.secret ?? null,
    });

    return this.webhookConfigRepo.save(config);
  }

  async getConfig(): Promise<WebhookConfig | null> {
    const storeId = StoreContext.getStoreId() as number;
    return this.webhookConfigRepo.findOne({
      where: { store_id: storeId, deleted_at: IsNull() },
    });
  }

  async delete(): Promise<void> {
    const storeId = StoreContext.getStoreId() as number;
    const config = await this.webhookConfigRepo.findOne({
      where: { store_id: storeId, deleted_at: IsNull() },
    });
    if (!config) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, 'Webhook配置不存在');
    }

    config.deleted_at = new Date();
    await this.webhookConfigRepo.save(config);
  }

  /**
   * Verify HMAC-SHA256 signature with timing-safe comparison.
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) return false;

    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature for outbound webhook push.
   */
  signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Sliding-window rate limiter: allows maxOps operations within windowMs.
   * Evicts expired timestamps before counting, so the limit is a true
   * "maxOps per windowMs" rather than a fixed cooldown gap.
   */
  private checkRateLimit(storeId: number): void {
    const key = `store:${storeId}`;
    const now = Date.now();
    const windowMs = 60000; // 60 seconds
    const maxOps = 5; // 5 config changes per 60s

    let timestamps = this.rateLimitMap.get(key) || [];
    // Evict expired entries outside the window
    timestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (timestamps.length >= maxOps) {
      const retryAfterSec = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      throw new BusinessException(
        ErrorCode.EXPORT_RATE_LIMITED,
        `Webhook配置变更过于频繁（${maxOps}次/${windowMs / 1000}秒），请${retryAfterSec}秒后再试`,
      );
    }

    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
  }
}
