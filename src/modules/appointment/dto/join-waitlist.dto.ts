import { IsInt, Min, IsDateString, IsString, MaxLength, Matches, IsOptional, IsEnum, Length } from 'class-validator';

export class JoinWaitlistDto {
  @IsInt()
  @Min(1)
  store_id: number;

  @IsDateString()
  appointment_date: string;

  @IsInt()
  @Min(1)
  time_slot_id: number;

  @IsString()
  @MaxLength(50)
  customer_name: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  customer_phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vehicle_info?: string;

  @IsEnum(['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'])
  service_type: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  sms_code?: string;
}
