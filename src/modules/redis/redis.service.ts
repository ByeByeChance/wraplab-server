import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err instanceof Error ? err.stack : undefined);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Blacklist a JWT by its JTI with a TTL equal to its remaining validity.
   */
  async blacklistJwt(jti: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`jwt_blacklist:${jti}`, '1', 'EX', ttlSeconds);
    this.logger.log(`JWT blacklisted: ${jti} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Check if a JWT JTI is blacklisted.
   */
  async isJwtBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.exists(`jwt_blacklist:${jti}`);
    return result === 1;
  }
}
