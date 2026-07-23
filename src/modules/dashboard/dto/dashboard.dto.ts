import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class DashboardTrendsQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  granularity?: 'day' | 'week' | 'month' = 'day';
}

export class DashboardTopQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = 10;
}
