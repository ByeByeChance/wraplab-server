import { Controller, Get, Query } from '@nestjs/common';
import { StoreLocationService, NearbyResult } from './store-location.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('stores')
export class StoreLocationController {
  constructor(private readonly storeLocationService: StoreLocationService) {}

  @Public()
  @Get('nearby')
  async findNearby(@Query() query: NearbyQueryDto): Promise<NearbyResult[]> {
    const results = await this.storeLocationService.findNearby(query.lat, query.lng, query.radius);
    return results;
  }
}
