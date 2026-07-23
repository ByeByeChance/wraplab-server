import { Controller, Put, Get, Delete, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { UpdateWebhookConfigDto } from './dto/webhook.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/webhook')
@Roles('manager', 'admin')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Put('config')
  @HttpCode(HttpStatus.OK)
  async upsert(@Body() dto: UpdateWebhookConfigDto) {
    return this.webhookService.upsert(dto);
  }

  @Get('config')
  async getConfig() {
    return this.webhookService.getConfig();
  }

  @Delete('config')
  @HttpCode(HttpStatus.OK)
  async delete() {
    await this.webhookService.delete();
    return null;
  }
}
