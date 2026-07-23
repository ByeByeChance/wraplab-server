import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SendSmsCodeDto } from './dto/send-sms-code.dto';
import { Public } from '../../common/decorators/public.decorator';
import { StrictRate } from '../../common/decorators/rate-limit.decorator';

@Controller('auth')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Public()
  @StrictRate()
  @Post('send-sms-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Body() dto: SendSmsCodeDto) {
    return this.smsService.sendCode(dto);
  }
}
