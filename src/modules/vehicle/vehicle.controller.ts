import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { Public } from '../../common/decorators/public.decorator';
import { RelaxedRate } from '../../common/decorators/rate-limit.decorator';

@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Public()
  @RelaxedRate()
  @Get('brands')
  async getBrands() {
    return this.vehicleService.getBrands();
  }

  @Public()
  @RelaxedRate()
  @Get('series')
  async getSeries(@Query('brandId', new ParseIntPipe({ optional: false })) brandId: number) {
    return this.vehicleService.getSeries(brandId);
  }

  @Public()
  @RelaxedRate()
  @Get('models')
  async getModels(@Query('seriesId', new ParseIntPipe({ optional: false })) seriesId: number) {
    return this.vehicleService.getModels(seriesId);
  }

  @Public()
  @RelaxedRate()
  @Get('models/:id')
  async getModelById(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleService.getModelById(id);
  }
}
