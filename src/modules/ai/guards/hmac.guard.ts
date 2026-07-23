import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/exceptions/error-codes';

@Injectable()
export class HmacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-signature'] as string;

    // Use raw body for deterministic HMAC verification
    const rawBody = request.rawBody as string | undefined;

    if (!signature) {
      throw new BusinessException(ErrorCode.FORBIDDEN, 'Missing callback signature');
    }

    if (!rawBody || typeof rawBody !== 'string') {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, 'Missing raw request body for HMAC verification');
    }

    const secret = process.env.AI_CALLBACK_SECRET;
    if (!secret) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 'AI_CALLBACK_SECRET not configured');
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new BusinessException(ErrorCode.FORBIDDEN, 'Invalid callback signature');
    }

    return true;
  }
}
