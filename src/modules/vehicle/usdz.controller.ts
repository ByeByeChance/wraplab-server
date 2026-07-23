import { Controller, Post, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsdzService } from './usdz.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class UsdzController {
  constructor(private readonly usdzService: UsdzService) {}

  @Post('admin/vehicles/models/:id/generate-usdz')
  @Roles('admin')
  async generate(@Param('id', ParseIntPipe) id: number) {
    return this.usdzService.generate(id);
  }

  @Get('vehicles/models/:id/usdz')
  async getInfo(@Param('id', ParseIntPipe) id: number) {
    return this.usdzService.getInfo(id);
  }
}
