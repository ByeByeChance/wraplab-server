import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CaseRecommendationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  store_id?: number;
}

export class RecommendedCaseDto {
  id: number;
  title: string;
  cover_image_url: string;
  vehicle_summary: string;
  like_count: number;
  match_reason?: string;
}
