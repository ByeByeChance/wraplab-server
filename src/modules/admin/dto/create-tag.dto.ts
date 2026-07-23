import { IsString, MinLength, MaxLength, IsOptional, Matches, IsInt, Min } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string = '#1890FF';

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  store_id?: number;
}
