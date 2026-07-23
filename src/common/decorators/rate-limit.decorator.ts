import { Throttle } from '@nestjs/throttler';

/**
 * Strict rate limit: 5 requests per 60s.
 * Use for login, SMS, and other sensitive/auth endpoints.
 */
export const StrictRate = () => Throttle({ default: { limit: 5, ttl: 60000 } });

/**
 * Normal rate limit: 30 requests per 60s.
 * Use for admin CRUD and general write endpoints.
 */
export const NormalRate = () => Throttle({ default: { limit: 30, ttl: 60000 } });

/**
 * Relaxed rate limit: 60 requests per 60s.
 * Use for read-heavy public endpoints (vehicles, colors, etc.).
 */
export const RelaxedRate = () => Throttle({ default: { limit: 60, ttl: 60000 } });
