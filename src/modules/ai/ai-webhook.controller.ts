import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiCallbackDto } from './dto/generate-image.dto';
import { HmacGuard } from './guards/hmac.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('internal')
export class AiWebhookController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @UseGuards(HmacGuard)
  @Post('ai-callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Body() dto: AiCallbackDto) {
    await this.aiService.handleCallback(dto);
    return { received: true };
  }
}
