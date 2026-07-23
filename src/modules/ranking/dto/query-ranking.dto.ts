import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export type RankingType = 'like_count' | 'view_count' | 'comment_count';
export type RankingPeriod = 'daily' | 'weekly' | 'monthly';

export class QueryRankingDto {
  @IsEnum(['like_count', 'view_count', 'comment_count'])
  type: RankingType;

  @IsEnum(['daily', 'weekly', 'monthly'])
  period: RankingPeriod;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.size ?? 20);
  }

  get take(): number {
    return this.size ?? 20;
  }
}
