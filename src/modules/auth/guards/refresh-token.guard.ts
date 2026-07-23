import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { Staff } from '../../staff/entities/staff.entity';
import { Store } from '../../store/entities/store.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/exceptions/error-codes';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = request.body?.refreshToken;

    if (!refreshToken) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '缺少 refreshToken');
    }

    let payload: {
      sub: number;
      store_id: number | null;
      role: string;
      token_version: number;
    };
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload & typeof payload;
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 'Refresh token 无效');
    }

    const staff = await this.staffRepo.findOne({
      where: { id: payload.sub },
    });

    if (!staff || staff.status !== 'active') {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    if (staff.token_version !== payload.token_version) {
      throw new BusinessException(ErrorCode.TOKEN_EXPIRED, 'Token 已失效，请重新登录');
    }

    // Verify store status (non-admin)
    if (payload.store_id !== null) {
      const store = await this.storeRepo.findOne({
        where: { id: payload.store_id },
      });
      if (!store || store.status !== 'active') {
        throw new BusinessException(ErrorCode.STORE_NOT_ACTIVE, '门店已停用');
      }
    }

    request.user = payload;
    return true;
  }
}
