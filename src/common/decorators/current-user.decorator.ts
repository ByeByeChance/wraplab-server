import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: number;
  store_id: number | null;
  role: 'admin' | 'manager' | 'staff';
  phone: string;
  token_version: number;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Extract the current authenticated user (JWT payload) from the request.
 * Usage: @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator((data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as JwtPayload;
  return data ? user?.[data] : user;
});
