import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitLoggingGuard extends ThrottlerGuard {
  private readonly logger = new Logger(RateLimitLoggingGuard.name);

  protected async handleRequest(
    context: any,
    limit: number,
    ttl: number,
    throttler: any,
    getTracker: any,
    generateKey: any,
  ): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return true;
    return super.handleRequest(context, limit, ttl, throttler, getTracker, generateKey);
  }

  protected async throwThrottlingException(context: any, throttlerLimitDetail: any): Promise<void> {
    const request = context.switchToHttp().getRequest();
    this.logger.warn(
      `Rate limited: ${request.ip} ${request.method} ${request.url} — limit: ${throttlerLimitDetail.limit}/${throttlerLimitDetail.ttl}ms`,
    );
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
