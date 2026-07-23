import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  @Public()
  async check() {
    const checks: Record<string, string> = {};

    // DB check
    try {
      await this.connection.query('SELECT 1');
      checks.database = 'ok';
    } catch (e: any) {
      checks.database = `error: ${e.message}`;
    }

    // Redis check (best effort — might not be configured in dev)
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        lazyConnect: true,
        connectTimeout: 3000,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      checks.redis = 'ok';
    } catch (e: any) {
      checks.redis = `unavailable: ${e.message}`;
    }

    const allOk = Object.values(checks).every(v => v === 'ok');

    return {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }
}
