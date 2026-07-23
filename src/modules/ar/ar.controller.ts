import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ArService } from './ar.service';

@Controller()
export class ArController {
  constructor(private readonly arService: ArService) {}

  @Get('configurations/:id/ar-texture')
  async getArTexture(@Param('id', ParseIntPipe) id: number) {
    return this.arService.getArTexture(id);
  }

  @Get('vehicles/models/:id/ar-config')
  async getArConfig(@Param('id', ParseIntPipe) id: number) {
    return this.arService.getArConfig(id);
  }
}
