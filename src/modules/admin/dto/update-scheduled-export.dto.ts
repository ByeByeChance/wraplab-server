import { IsString, MaxLength, IsEnum, IsArray, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RecipientDto {
  email: string;
  phone?: string;
}

export class UpdateScheduledExportDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(['pdf', 'excel', 'csv'])
  export_type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cron_expression?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients?: { email: string; phone?: string }[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
