import { IsString, MaxLength, IsOptional, IsArray, Matches, IsObject } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };

  @IsOptional()
  @IsObject()
  business_hours?: { open: string; close: string; off_days: string[] };

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services_offered?: string[];

  @IsOptional()
  @IsObject()
  capacity_config?: {
    max_daily_appointments: number;
    slot_duration_minutes: number;
  };

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
