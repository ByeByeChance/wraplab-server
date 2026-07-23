import { IsOptional, IsEnum, IsString, IsObject, IsArray } from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };

  @IsOptional()
  @IsObject()
  business_hours?: { open: string; close: string; off_days: string[] };

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
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
