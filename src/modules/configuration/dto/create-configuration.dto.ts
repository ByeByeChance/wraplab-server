import { IsInt, IsString, IsOptional, Min, Matches, MaxLength } from 'class-validator';

export class CreateConfigurationDto {
  @IsInt()
  @Min(1)
  model_id: number;

  @IsInt()
  @Min(1)
  color_swatch_id: number;

  @IsInt()
  @Min(1)
  material_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  customer_phone?: string;
}

export class UpdateConfigurationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  color_swatch_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  material_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  customer_phone?: string;
}
