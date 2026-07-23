import { IsOptional, IsInt, Min } from 'class-validator';

export class ListCommentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 20;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.size ?? 20);
  }

  get take(): number {
    return this.size ?? 20;
  }
}
