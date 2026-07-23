import { Controller, Post, Put, Delete, Get, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import { CreateSeriesDto, UpdateSeriesDto } from './dto/create-series.dto';
import { CreateModelDto, UpdateModelDto } from './dto/create-model.dto';
import { BatchUpdatePartAreaDto } from './dto/part-area.dto';

@Controller('admin/vehicles')
@Roles('admin')
export class AdminVehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  // Brands
  @Post('brands')
  @HttpCode(HttpStatus.CREATED)
  async createBrand(@Body() dto: CreateBrandDto) {
    return this.vehicleService.createBrand(dto);
  }

  @Put('brands/:id')
  async updateBrand(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.vehicleService.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBrand(@Param('id', ParseIntPipe) id: number) {
    await this.vehicleService.deleteBrand(id);
    return null;
  }

  // Series
  @Post('series')
  @HttpCode(HttpStatus.CREATED)
  async createSeries(@Body() dto: CreateSeriesDto) {
    return this.vehicleService.createSeries(dto);
  }

  @Put('series/:id')
  async updateSeries(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeriesDto) {
    return this.vehicleService.updateSeries(id, dto);
  }

  @Delete('series/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSeries(@Param('id', ParseIntPipe) id: number) {
    await this.vehicleService.deleteSeries(id);
    return null;
  }

  // Models
  @Post('models')
  @HttpCode(HttpStatus.CREATED)
  async createModel(@Body() dto: CreateModelDto) {
    return this.vehicleService.createModel(dto);
  }

  @Put('models/:id')
  async updateModel(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModelDto) {
    return this.vehicleService.updateModel(id, dto);
  }

  @Delete('models/:id')
  @HttpCode(HttpStatus.OK)
  async deleteModel(@Param('id', ParseIntPipe) id: number) {
    await this.vehicleService.deleteModel(id);
    return null;
  }

  // Part Area Management

  @Get('models/:id/parts')
  @Roles('admin', 'manager')
  async getPartAreas(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleService.getPartAreas(id);
  }

  @Get('models/:id/parts/area')
  @Roles('admin', 'manager')
  async getPartAreaSummary(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleService.getPartAreaSummary(id);
  }

  @Put('models/:id/parts/batch')
  @HttpCode(HttpStatus.OK)
  async batchUpdatePartAreas(@Param('id', ParseIntPipe) id: number, @Body() dto: BatchUpdatePartAreaDto) {
    return this.vehicleService.batchUpdatePartAreas(id, dto.parts);
  }

  @Post('models/:id/parts/copy-from/:templateModelId')
  @HttpCode(HttpStatus.OK)
  async copyPartAreas(
    @Param('id', ParseIntPipe) id: number,
    @Param('templateModelId', ParseIntPipe) templateModelId: number,
  ) {
    return this.vehicleService.copyPartAreas(id, templateModelId);
  }
}
