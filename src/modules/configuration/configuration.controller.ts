import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { CreateConfigurationDto, UpdateConfigurationDto } from './dto/create-configuration.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('configurations')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateConfigurationDto) {
    return this.configurationService.create(dto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.configurationService.findAll(pagination, status);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.configurationService.findById(id);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateConfigurationDto) {
    return this.configurationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.configurationService.delete(id);
    return null;
  }
}
