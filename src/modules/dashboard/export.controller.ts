import { Controller, Post, Get, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ScheduledExportService } from './scheduled-export.service';
import { CsvExportService } from './csv-export.service';
import { CreateScheduledExportDto } from '../admin/dto/create-scheduled-export.dto';
import { UpdateScheduledExportDto } from '../admin/dto/update-scheduled-export.dto';
import { CsvExportDto } from '../admin/dto/csv-export.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Header, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller('admin/exports')
@Roles('admin', 'manager')
export class ExportController {
  constructor(
    private readonly scheduledExportService: ScheduledExportService,
    private readonly csvExportService: CsvExportService,
  ) {}

  @Post('schedules')
  async createSchedule(@Body() dto: CreateScheduledExportDto, @CurrentUser() user: JwtPayload) {
    return this.scheduledExportService.create(user.store_id ?? 0, dto);
  }

  @Get('schedules')
  async listSchedules(@CurrentUser() user: JwtPayload) {
    return this.scheduledExportService.findAll(user.store_id ?? 0);
  }

  @Put('schedules/:id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduledExportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.scheduledExportService.update(id, user.store_id ?? 0, dto);
  }

  @Delete('schedules/:id')
  async deleteSchedule(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    await this.scheduledExportService.delete(id, user.store_id ?? 0);
    return { success: true };
  }

  @Get('schedules/:id/logs')
  async getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.scheduledExportService.getLogs(id);
  }

  @Post('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="export.csv"')
  async exportCsv(@Body() dto: CsvExportDto, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    await this.csvExportService.validateExport(dto, user.store_id ?? 0);
    const csv = await this.csvExportService.generateCsv(dto, user.store_id ?? 0);
    res.send(csv);
  }
}
