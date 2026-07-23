import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsDateString,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(['PERCENTAGE', 'FIXED_AMOUNT', 'GIFT'])
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT';

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount_value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  min_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  gift_name?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  target_store_ids?: number[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  new_customer_only?: boolean;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(['PERCENTAGE', 'FIXED_AMOUNT', 'GIFT'])
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'GIFT';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  min_amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  gift_name?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  target_store_ids?: number[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  new_customer_only?: boolean;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class ApplyCampaignDto {
  @IsNumber()
  @Type(() => Number)
  campaign_id: number;
}

export class ApproveCampaignDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reject_reason?: string;
}

export class ScheduleCampaignDto {
  @IsDateString()
  scheduledAt: string;
}
