import { Controller, Post, Get, Put, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { StaffService } from './staff.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto';

@Controller('admin/staff')
@Roles('manager', 'admin')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async findAll() {
    return this.staffService.findByStore();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }
}
