import { IsArray, ValidateNested, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class StoreServiceConfigItemDto {
  @IsEnum(['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'])
  service_type: string;

  @IsInt()
  @Min(10)
  @Max(1440)
  duration_minutes: number;
}

export class UpdateStoreServiceConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreServiceConfigItemDto)
  services: StoreServiceConfigItemDto[];
}

export class StoreServiceConfigResponseDto {
  service_type: string;
  duration_minutes: number;
  label: string;
  source: 'global' | 'custom';
}
