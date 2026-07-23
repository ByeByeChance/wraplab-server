import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { ColorService } from './color.service';
import { Public } from '../../common/decorators/public.decorator';
import { RelaxedRate } from '../../common/decorators/rate-limit.decorator';

@Controller('colors')
export class ColorController {
  constructor(private readonly colorService: ColorService) {}

  @Public()
  @RelaxedRate()
  @Get('brands')
  async getBrands() {
    return this.colorService.getColorBrands();
  }

  @Public()
  @RelaxedRate()
  @Get('swatches')
  async getSwatches(@Query('brandId', new ParseIntPipe({ optional: false })) brandId: number) {
    return this.colorService.getSwatches(brandId);
  }

  @Public()
  @RelaxedRate()
  @Get('materials')
  async getMaterials() {
    return this.colorService.getMaterials();
  }
}
