import { RedisService } from '../../modules/redis/redis.service';

// TTL constants (in seconds)
export const CACHE_TTL = {
  VEHICLES: 3600,       // 1h
  COLORS: 7200,         // 2h
  STORE: 1800,          // 30min
  POPULAR_CASES: 900,   // 15min
} as const;

/**
 * Cache method result in Redis.
 * Usage: @Cacheable('vehicles:brands', { ttl: 3600 })
 *
 * NOTE: NestJS method decorators cannot access injected services via `this`
 * because decorators run at class definition time. Use manual caching in the
 * service methods instead. This decorator is provided for reference and
 * lightweight use cases where a moduleRef or global registry is available.
 */
export function Cacheable(key: string, options: { ttl?: number } = {}) {
  const ttl = options.ttl ?? 300;

  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Resolve RedisService from `this` context (NestJS injects it)
      const redisService: RedisService = (this as any).redisService;
      if (!redisService) return originalMethod.apply(this, args);

      const cacheKey = `${key}:${JSON.stringify(args)}`;

      try {
        const cached = await redisService.getClient().get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* cache miss, fall through */ }

      const result = await originalMethod.apply(this, args);

      if (result !== null && result !== undefined) {
        try {
          await redisService.getClient().setex(cacheKey, ttl, JSON.stringify(result));
        } catch { /* cache write failed, ignore */ }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Invalidate cache keys matching a pattern.
 * Usage: @CacheEvict('vehicles:*')
 *
 * NOTE: Same DI limitation as Cacheable. Prefer manual invalidation in
 * service methods.
 */
export function CacheEvict(pattern: string) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      const redisService: RedisService = (this as any).redisService;
      if (redisService) {
        try {
          const client = redisService.getClient();
          const keys = await client.keys(pattern);
          if (keys.length > 0) {
            await client.del(...keys);
          }
        } catch { /* ignore */ }
      }

      return result;
    };

    return descriptor;
  };
}
