import { IsString, IsInt, IsOptional, Min, MaxLength, IsArray, ArrayMaxSize } from 'class-validator';

export class CreateCaseDto {
  @IsInt()
  @Min(1)
  configuration_id: number;

  @IsString()
  @Min(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover_image_url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  images?: string[];
}

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cover_image_url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  images?: string[];
}
