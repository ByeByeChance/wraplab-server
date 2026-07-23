import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class CreateModelDto {
  @IsInt()
  @Min(1)
  series_id: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsInt()
  year: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  body_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  model_3d_url?: string;
}

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  body_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  model_3d_url?: string;
}
