import { Controller, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ColorService } from './color.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateColorBrandDto, UpdateColorBrandDto } from './dto/create-color-brand.dto';
import { CreateColorSwatchDto, UpdateColorSwatchDto } from './dto/create-color-swatch.dto';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/create-material.dto';

@Controller('admin/colors')
@Roles('admin')
export class AdminColorController {
  constructor(private readonly colorService: ColorService) {}

  // Color Brands
  @Post('brands')
  @HttpCode(HttpStatus.CREATED)
  async createBrand(@Body() dto: CreateColorBrandDto) {
    return this.colorService.createColorBrand(dto);
  }

  @Put('brands/:id')
  async updateBrand(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColorBrandDto) {
    return this.colorService.updateColorBrand(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBrand(@Param('id', ParseIntPipe) id: number) {
    await this.colorService.deleteColorBrand(id);
    return null;
  }

  // Swatches
  @Post('swatches')
  @HttpCode(HttpStatus.CREATED)
  async createSwatch(@Body() dto: CreateColorSwatchDto) {
    return this.colorService.createColorSwatch(dto);
  }

  @Put('swatches/:id')
  async updateSwatch(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColorSwatchDto) {
    return this.colorService.updateColorSwatch(id, dto);
  }

  @Delete('swatches/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSwatch(@Param('id', ParseIntPipe) id: number) {
    await this.colorService.deleteColorSwatch(id);
    return null;
  }

  // Materials
  @Post('materials')
  @HttpCode(HttpStatus.CREATED)
  async createMaterial(@Body() dto: CreateMaterialDto) {
    return this.colorService.createMaterial(dto);
  }

  @Put('materials/:id')
  async updateMaterial(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMaterialDto) {
    return this.colorService.updateMaterial(id, dto);
  }

  @Delete('materials/:id')
  @HttpCode(HttpStatus.OK)
  async deleteMaterial(@Param('id', ParseIntPipe) id: number) {
    await this.colorService.deleteMaterial(id);
    return null;
  }
}
