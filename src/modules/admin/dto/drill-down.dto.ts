import { IsEnum, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DrillDownQueryDto {
  @IsEnum(['revenue', 'quotes', 'appointments', 'customers'])
  metric_type: string;

  @IsEnum(['monthly', 'weekly'])
  period: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsEnum(['staff', 'brand', 'service_type', 'day'])
  group_by: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}

export class DrillDownItemDto {
  dimension_value: string;
  metric_value: number;
  percentage?: number;
}
