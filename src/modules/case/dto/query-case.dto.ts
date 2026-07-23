import { IsOptional, IsString, IsInt, Min, MaxLength } from 'class-validator';

export class QueryCaseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(1)
  model_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  color_swatch_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string = 'published';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sort?: string = 'created_at';

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.size ?? 20);
  }

  get take(): number {
    return this.size ?? 20;
  }
}
