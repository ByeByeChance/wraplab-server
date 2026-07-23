import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';
import { Store } from '../../store/entities/store.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/exceptions/error-codes';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Short-lived in-memory cache: avoid hitting DB on every request, TTL 60s
  private statusCache = new Map<number, { active: boolean; tokenVersion: number; ts: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    configService: ConfigService,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Check in-memory cache first
    const cached = this.statusCache.get(payload.sub);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      if (!cached.active || cached.tokenVersion !== payload.token_version) {
        throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用或密码已修改，请重新登录');
      }
      return payload;
    }

    const staff = await this.staffRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'status', 'store_id', 'token_version'],
    });

    if (!staff || staff.status !== 'active') {
      this.statusCache.set(payload.sub, {
        active: false,
        tokenVersion: 0,
        ts: Date.now(),
      });
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    // Verify token_version match (invalidates old tokens after password change)
    if (payload.token_version !== staff.token_version) {
      this.statusCache.set(payload.sub, {
        active: false,
        tokenVersion: staff.token_version,
        ts: Date.now(),
      });
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 'Token 已失效，请重新登录');
    }

    // Verify store status (admin has null store_id, skip check)
    if (payload.store_id !== null) {
      const store = await this.storeRepo.findOne({
        where: { id: payload.store_id },
        select: ['id', 'status'],
      });
      if (!store || store.status !== 'active') {
        this.statusCache.set(payload.sub, {
          active: false,
          tokenVersion: staff.token_version,
          ts: Date.now(),
        });
        throw new BusinessException(ErrorCode.STORE_NOT_ACTIVE, '门店已停用');
      }
    }

    this.statusCache.set(payload.sub, {
      active: true,
      tokenVersion: staff.token_version,
      ts: Date.now(),
    });
    return payload;
  }
}
