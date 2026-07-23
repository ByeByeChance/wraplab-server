import { Controller, Post, Get, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { StoreAdminService } from './store-admin.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { QueryStoreDto } from './dto/query-store.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/stores')
@Roles('admin')
export class StoreAdminController {
  constructor(private readonly storeAdminService: StoreAdminService) {}

  @Post()
  async create(@Body() dto: CreateStoreDto) {
    return this.storeAdminService.create(dto);
  }

  @Get()
  async findAll(@Query() query: QueryStoreDto) {
    return this.storeAdminService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.storeAdminService.findById(id);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreDto) {
    return this.storeAdminService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.storeAdminService.delete(id);
  }
}
