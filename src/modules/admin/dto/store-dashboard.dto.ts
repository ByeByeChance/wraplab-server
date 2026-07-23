import { IsEnum, IsOptional, IsDateString, IsString, Matches } from 'class-validator';

export class StoreDashboardQueryDto {
  @IsEnum(['daily', 'weekly', 'monthly'])
  period: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class StoreComparisonQueryDto {
  @IsString()
  @Matches(/^\d+(,\d+)*$/)
  store_ids: string;

  @IsEnum(['daily', 'weekly', 'monthly'])
  period: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class StoreDashboardDto {
  total_revenue: number;
  quote_count: number;
  conversion_rate: number;
  appointment_count: number;
  arrival_rate: number;
  new_customer_count: number;
  average_order_value: number;
  top_staff: { staff_id: number; name: string; revenue: number }[];
}

export class StoreComparisonDto {
  items: StoreDashboardDto[];
  platform_average: {
    revenue_avg: number;
    conversion_rate_avg: number;
    arrival_rate_avg: number;
  };
}
