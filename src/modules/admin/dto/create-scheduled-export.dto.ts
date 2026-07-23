import { IsString, MaxLength, IsEnum, IsArray, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RecipientDto {
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateScheduledExportDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(['pdf', 'excel', 'csv'])
  export_type: string;

  @IsArray()
  @IsString({ each: true })
  sections: string[];

  @IsString()
  @MaxLength(50)
  cron_expression: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: { email: string; phone?: string }[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}
