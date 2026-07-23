import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class CreateSeriesDto {
  @IsInt()
  @Min(1)
  brand_id: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  year_start?: number;

  @IsOptional()
  @IsInt()
  year_end?: number;
}

export class UpdateSeriesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  year_start?: number;

  @IsOptional()
  @IsInt()
  year_end?: number;
}
