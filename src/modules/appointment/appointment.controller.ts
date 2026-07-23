import { Controller, Post, Get, Put, Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import {
  CreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  FindSlotsQueryDto,
  SendVerifyCodeDto,
  VerifyCodeDto,
} from './dto/appointment.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // Public — create appointment (IP rate-limited)
  @Public()
  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create({
      store_id: dto.store_id,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      service_type: dto.service_type,
      appointment_date: dto.appointment_date,
      time_slot: dto.time_slot,
      vehicle_info: dto.vehicle_info,
      remark: dto.remark,
    });
  }

  // Public — find slots (IP rate-limited)
  @Public()
  @Get('appointments/slots')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async findSlots(@Query() query: FindSlotsQueryDto) {
    return this.appointmentService.findSlots(query.store_id, query.date);
  }

  // Public — service types (IP rate-limited)
  @Public()
  @Get('appointments/service-types')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getServiceTypes() {
    return this.appointmentService.getServiceTypes();
  }

  // Authenticated — my appointments
  @Get('appointments/mine')
  async findMine(@Query() pagination: PaginationDto) {
    return this.appointmentService.findMine(pagination);
  }

  // Authenticated — cancel my appointment
  @Put('appointments/mine/:id/cancel')
  async cancelMine(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelAppointmentDto) {
    return this.appointmentService.cancel(id, dto.reason);
  }

  // Admin — list all
  @Get('admin/appointments')
  @Roles('manager', 'admin')
  async findAll(@Query() pagination: PaginationDto) {
    return this.appointmentService.findAll(pagination);
  }

  // Admin — confirm
  @Put('admin/appointments/:id/confirm')
  @Roles('manager', 'admin')
  async confirm(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.confirm(id);
  }

  // Admin — reschedule
  @Put('admin/appointments/:id/reschedule')
  @Roles('manager', 'admin')
  async reschedule(@Param('id', ParseIntPipe) id: number, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentService.reschedule(id, dto);
  }

  // Authenticated — send appointment verify code
  @Post('appointments/send-verify-code')
  async sendVerifyCode(@Body() dto: SendVerifyCodeDto) {
    return this.appointmentService.sendVerifyCode(dto.appointmentId);
  }

  // Authenticated — verify appointment code
  @Post('appointments/verify-code')
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.appointmentService.verifyCode(dto.appointmentId, dto.code);
  }
}
