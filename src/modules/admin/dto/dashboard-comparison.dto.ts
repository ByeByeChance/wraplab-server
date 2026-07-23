import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export class DashboardComparisonQueryDto {
  @IsEnum(['yoy', 'mom'])
  compare_type: 'yoy' | 'mom';

  @IsEnum(['monthly', 'quarterly'])
  period: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class MetricComparisonDto {
  current: number;
  previous: number;
  growth_pct: number | null;
}

export class DashboardComparisonResponseDto {
  revenue: MetricComparisonDto;
  quote_count: MetricComparisonDto;
  appointment_count: MetricComparisonDto;
  conversion_rate: MetricComparisonDto;
  new_customer_count: MetricComparisonDto;
  average_order_value: MetricComparisonDto;
  period_label: string;
}
