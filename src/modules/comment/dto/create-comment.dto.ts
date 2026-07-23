import { IsString, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parent_id?: number;
}
