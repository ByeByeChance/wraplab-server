import { Controller, Post, Get, Delete, Param, Query, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post(':configId')
  @HttpCode(HttpStatus.CREATED)
  async add(@Param('configId', ParseIntPipe) configId: number) {
    return this.favoriteService.add(configId);
  }

  @Delete(':configId')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('configId', ParseIntPipe) configId: number) {
    await this.favoriteService.remove(configId);
    return null;
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.favoriteService.findAll(pagination);
  }
}
