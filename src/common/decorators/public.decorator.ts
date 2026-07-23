import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler as public (skip JWT authentication).
 * Usage: @Public() on controller class or individual method.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
