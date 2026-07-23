import { IsString, IsEnum, IsOptional, IsNumber, IsNotEmpty, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  store_id: number;

  @IsString()
  @MaxLength(100)
  customer_name: string;

  @IsString()
  @MaxLength(20)
  customer_phone: string;

  @IsString()
  @MaxLength(50)
  service_type: string;

  @IsDateString()
  appointment_date: string;

  @IsEnum(['MORNING', 'AFTERNOON', 'EVENING'])
  time_slot: 'MORNING' | 'AFTERNOON' | 'EVENING';

  @IsOptional()
  vehicle_info?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class CancelAppointmentDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RescheduleAppointmentDto {
  @IsDateString()
  appointment_date: string;

  @IsEnum(['MORNING', 'AFTERNOON', 'EVENING'])
  time_slot: 'MORNING' | 'AFTERNOON' | 'EVENING';
}

export class FindSlotsQueryDto {
  @Type(() => Number)
  store_id: number;

  @IsDateString()
  date: string;
}

export class SendVerifyCodeDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  appointmentId: number;
}

export class VerifyCodeDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  appointmentId: number;

  @IsString()
  @MaxLength(6)
  code: string;
}
