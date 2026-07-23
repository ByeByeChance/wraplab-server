import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Staff } from '../staff/entities/staff.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { SmsService } from '../sms/sms.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { LoginDto } from './dto/login.dto';
import { SmsLoginDto } from './dto/sms-login.dto';
import { maskWechatOpenId } from '../../common/utils/sanitize';
import { IsNull } from 'typeorm';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TTL = 900; // 15 minutes

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds: number;

  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(StaffStore)
    private readonly staffStoreRepo: Repository<StaffStore>,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly redisService: RedisService,
  ) {
    this.bcryptSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10) || 12;
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    available_stores: { store_id: number; store_name: string; role_in_store: string }[];
  }> {
    // Check login lockout
    const lockoutKey = `login_attempts:${dto.phone}`;
    const attempts = await this.redisService.getClient().get(lockoutKey);
    if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
      const ttl = await this.redisService.getClient().ttl(lockoutKey);
      this.logger.warn(`Login blocked for ${dto.phone} — too many attempts (${attempts}), retry in ${ttl}s`);
      throw new BusinessException(ErrorCode.LOGIN_FAILED, '登录失败次数过多，请15分钟后再试');
    }

    const staff = await this.staffRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'store_id', 'current_store_id', 'role', 'phone', 'password_hash', 'status', 'token_version'],
    });

    if (!staff) {
      await this.recordFailedAttempt(lockoutKey);
      throw new BusinessException(ErrorCode.LOGIN_FAILED, '手机号或密码错误');
    }

    if (staff.status !== 'active') {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, staff.password_hash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(lockoutKey);
      throw new BusinessException(ErrorCode.LOGIN_FAILED, '手机号或密码错误');
    }

    // Clear failed attempts on successful login
    await this.redisService.getClient().del(lockoutKey);

    const payload = {
      sub: staff.id,
      store_id: Number(staff.current_store_id),
      role: staff.role,
      phone: staff.phone,
      token_version: staff.token_version,
      jti: crypto.randomUUID(),
    };

    const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '7200', 10);
    const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    // Get available stores
    const staffStores = await this.staffStoreRepo.find({
      where: { staff_id: staff.id, deleted_at: IsNull() },
    });

    const available_stores = staffStores.map((ss) => ({
      store_id: Number(ss.store_id),
      store_name: '',
      role_in_store: ss.role_in_store,
    }));

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      available_stores,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    let payload: {
      sub: number;
      store_id: number | null;
      role: string;
      phone: string;
      token_version: number;
    };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 'Refresh token 无效');
    }

    // Re-verify staff status
    const staff = await this.staffRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'status', 'token_version', 'store_id', 'role', 'phone'],
    });

    if (!staff || staff.status !== 'active') {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    // Use latest token_version
    const newPayload = {
      sub: staff.id,
      store_id: Number(staff.current_store_id || staff.store_id),
      role: staff.role,
      phone: staff.phone,
      token_version: staff.token_version,
      jti: crypto.randomUUID(),
    };

    const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '7200', 10);
    const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  async wechatLogin(
    code: string,
    staff_id?: number,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Exchange code for openid
    const openid = await this.getWechatOpenId(code);

    // Try to find staff by openid
    const staffByOpenid = await this.staffRepo.findOne({
      where: { wechat_openid: openid },
      select: ['id', 'store_id', 'role', 'phone', 'status', 'token_version', 'wechat_openid'],
    });

    if (staffByOpenid) {
      if (staffByOpenid.status !== 'active') {
        throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
      }
      return this.issueTokens(staffByOpenid);
    }

    // Openid not found — if staff_id provided, bind it
    if (staff_id) {
      const staff = await this.staffRepo.findOne({
        where: { id: staff_id },
        select: ['id', 'store_id', 'role', 'phone', 'status', 'token_version', 'wechat_openid'],
      });

      if (!staff) {
        throw new BusinessException(ErrorCode.STAFF_NOT_FOUND, '店员不存在');
      }

      if (staff.wechat_openid) {
        this.logger.warn('wechat_openid already bound', {
          staffId: staff_id,
          wechat_openid: maskWechatOpenId(staff.wechat_openid),
        });
        throw new BusinessException(ErrorCode.WECHAT_ALREADY_BOUND, '该微信已绑定其他账号');
      }

      // Bind openid to staff
      await this.staffRepo.update(staff_id, { wechat_openid: openid } as Partial<Staff>);
      staff.wechat_openid = openid;

      return this.issueTokens(staff);
    }

    // Not bound and no staff_id — user needs to bind first
    throw new BusinessException(ErrorCode.WECHAT_NOT_BOUND, '微信未绑定，请先通过手机号登录后绑定微信');
  }

  async bindWechat(staffId: number, code: string): Promise<{ success: boolean }> {
    const openid = await this.getWechatOpenId(code);

    // Check if this openid is already bound to another staff
    const existingStaff = await this.staffRepo.findOne({
      where: { wechat_openid: openid },
      select: ['id'],
    });

    if (existingStaff && existingStaff.id !== staffId) {
      throw new BusinessException(ErrorCode.WECHAT_ALREADY_BOUND, '该微信已绑定其他账号');
    }

    // Check if current staff already has wechat bound
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      select: ['id', 'wechat_openid'],
    });

    if (staff?.wechat_openid) {
      throw new BusinessException(ErrorCode.WECHAT_ALREADY_BOUND, '当前账号已绑定微信');
    }

    await this.staffRepo.update(staffId, { wechat_openid: openid } as Partial<Staff>);

    this.logger.log('wechat_openid bound successfully', { staffId, wechat_openid: maskWechatOpenId(openid) });

    return { success: true };
  }

  private async getWechatOpenId(code: string): Promise<string> {
    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    if (!appId || !secret) {
      throw new BusinessException(ErrorCode.WECHAT_LOGIN_FAILED, '微信登录未配置');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get('https://api.weixin.qq.com/sns/jscode2session', {
          params: {
            appid: appId,
            secret: secret,
            js_code: code,
            grant_type: 'authorization_code',
          },
          timeout: 10000,
        }),
      );

      const data = response.data as { openid?: string; errcode?: number; errmsg?: string };

      if (data.errcode) {
        this.logger.error(`WeChat jscode2session error: ${data.errcode} ${data.errmsg}`);
        throw new BusinessException(ErrorCode.WECHAT_LOGIN_FAILED, '微信登录失败，请重试');
      }

      if (!data.openid) {
        throw new BusinessException(ErrorCode.WECHAT_LOGIN_FAILED, '微信登录失败，请重试');
      }

      this.logger.log('wechat_openid obtained', { wechat_openid: maskWechatOpenId(data.openid) });

      return data.openid;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const err = error as Error;
      this.logger.error(`WeChat API call failed: ${err.message}`, err.stack);
      throw new BusinessException(ErrorCode.WECHAT_LOGIN_FAILED, '微信登录失败，请重试');
    }
  }

  private issueTokens(staff: Staff): { accessToken: string; refreshToken: string; expiresIn: number } {
    const payload = {
      sub: staff.id,
      store_id: Number(staff.current_store_id || staff.store_id),
      role: staff.role,
      phone: staff.phone,
      token_version: staff.token_version,
      jti: crypto.randomUUID(),
    };

    const accessExpiresIn = parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '7200', 10);
    const refreshExpiresIn = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  private async recordFailedAttempt(key: string): Promise<void> {
    const client = this.redisService.getClient();
    const attempts = await client.incr(key);
    if (attempts === 1) {
      await client.expire(key, LOGIN_LOCKOUT_TTL);
    }
    this.logger.warn(`Failed login attempt #${attempts} for key=${key}`);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptSaltRounds);
  }

  async sendSmsCode(phone: string): Promise<{ expires_at: string }> {
    // Check if phone is registered
    const staff = await this.staffRepo.findOne({
      where: { phone },
      select: ['id', 'status'],
    });

    if (!staff) {
      throw new BusinessException(ErrorCode.PHONE_NOT_REGISTERED, '该手机号未注册');
    }

    if (staff.status !== 'active') {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    return this.smsService.sendCode({ phone, type: 'login' });
  }

  async smsLogin(dto: SmsLoginDto): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Verify SMS code
    await this.smsService.verifyCode(dto.phone, dto.sms_code, 'login');

    // Find staff by phone
    const staff = await this.staffRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'store_id', 'current_store_id', 'role', 'phone', 'status', 'token_version'],
    });

    if (!staff) {
      throw new BusinessException(ErrorCode.PHONE_NOT_REGISTERED_LOGIN, '该手机号未注册');
    }

    if (staff.status !== 'active') {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用');
    }

    return this.issueTokens(staff);
  }
}
