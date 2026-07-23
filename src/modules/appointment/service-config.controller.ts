import { Controller, Get, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { TimeSlotCapacityService } from './time-slot-capacity.service';
import { UpdateStoreServiceConfigDto } from './dto/store-service-config.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class ServiceConfigController {
  constructor(private readonly timeSlotCapacityService: TimeSlotCapacityService) {}

  @Public()
  @Get('stores/:id/service-config')
  async getConfig(@Param('id', ParseIntPipe) id: number) {
    return this.timeSlotCapacityService.getStoreServiceConfig(id);
  }

  @Put('admin/stores/:id/service-config')
  @Roles('admin', 'manager')
  async updateConfig(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreServiceConfigDto) {
    await this.timeSlotCapacityService.updateStoreServiceConfig(id, dto);
    return { success: true };
  }
}
