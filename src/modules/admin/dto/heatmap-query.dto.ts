import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class HeatmapQueryDto {
  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsEnum(['grid', 'city'])
  aggregation: 'grid' | 'city';

  @IsOptional()
  @IsEnum(['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'])
  service_type?: string;
}

export class HeatmapDataPointDto {
  lat?: number;
  lng?: number;
  city?: string;
  density: number;
}
