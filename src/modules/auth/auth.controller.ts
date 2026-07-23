import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { WechatLoginDto, BindWechatDto } from './dto/wechat-login.dto';
import { SmsLoginDto, SendSmsCodeDto } from './dto/sms-login.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Public } from '../../common/decorators/public.decorator';
import { StrictRate } from '../../common/decorators/rate-limit.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CryptoService } from '../../common/crypto/crypto.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cryptoService: CryptoService,
  ) {}

  @Public()
  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.cryptoService.publicKey };
  }

  @Public()
  @StrictRate()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('wechat-login')
  async wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto.code, dto.staff_id);
  }

  @Post('bind-wechat')
  async bindWechat(@Body() dto: BindWechatDto, @CurrentUser() user: JwtPayload) {
    return this.authService.bindWechat(user.sub, dto.code);
  }

  @Public()
  @StrictRate()
  @Post('send-sms-code')
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.authService.sendSmsCode(dto.phone);
  }

  @Public()
  @Post('sms-login')
  async smsLogin(@Body() dto: SmsLoginDto) {
    return this.authService.smsLogin(dto);
  }
}
