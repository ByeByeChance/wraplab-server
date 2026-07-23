import { Controller, Post, Get, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateImageDto } from './dto/generate-image.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('configurations/:id/generate-image')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateImage(@Param('id', ParseIntPipe) configId: number, @Body() dto: GenerateImageDto) {
    return this.aiService.generateImage(configId, dto);
  }

  @Get('configurations/:id/generations')
  async findByConfigId(@Param('id', ParseIntPipe) configId: number) {
    return this.aiService.findByConfigId(configId);
  }

  @Get('generations/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.findOne(id);
  }

  @Get('generations/:id/queue-status')
  async getQueueStatus(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.getQueueStatus(id);
  }

  @Get('admin/ai-queue/stats')
  @Roles('admin')
  async getQueueStats() {
    return this.aiService.getQueueStats();
  }
}
