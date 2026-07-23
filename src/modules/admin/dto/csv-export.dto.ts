import { IsEnum, IsDateString, IsOptional, IsArray, IsString, IsObject } from 'class-validator';

export class CsvExportDto {
  @IsEnum(['customers', 'quotes', 'appointments', 'revenue'])
  data_type: string;

  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @IsOptional()
  @IsObject()
  filters?: {
    brand_id?: number;
    service_type?: string;
    staff_id?: number;
    status?: string;
  };
}

export class CsvExportResponseDto {
  export_id: number;
  status: 'processing';
  estimated_seconds: number;
}
