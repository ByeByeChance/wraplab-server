import { IsString, IsOptional, IsInt, Min, Max, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateColorSwatchDto {
  @IsInt()
  @Min(1)
  brand_id: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'hex must be a valid hex color like #FFD700' })
  hex: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_r: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_g: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_b: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  price_per_m2?: number;
}

export class UpdateColorSwatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'hex must be a valid hex color like #FFD700' })
  hex?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_r?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_g?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  rgb_b?: number;

  @IsOptional()
  @Min(0)
  price_per_m2?: number;
}
