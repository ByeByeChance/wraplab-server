import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { Case } from './entities/case.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { RecommendedCaseDto } from './dto/case-recommendation.dto';

interface RecommendedCase extends Case {
  _boosted?: boolean;
}

@Injectable()
export class CaseRecommendationService {
  private readonly logger = new Logger(CaseRecommendationService.name);

  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
  ) {}

  async recommend(caseId: number, limit: number = 6, storeId?: number): Promise<RecommendedCaseDto[]> {
    const currentCase = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
    });
    if (!currentCase) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    try {
      // Layer 1: Same store cases (closest match, 40% weight)
      const sameStoreCases = await this.caseRepo.find({
        where: {
          store_id: currentCase.store_id,
          id: Not(caseId),
          status: 'published',
          deleted_at: IsNull(),
        },
        order: { like_count: 'DESC', view_count: 'DESC' },
        take: Math.ceil(limit * 0.4),
      });

      const excludedIds: number[] = [caseId, ...sameStoreCases.map((c) => Number(c.id))];

      // Layer 2: Popular cases excluding Layer 1 (30% weight)
      const sameColorCases: Case[] = [];
      if (excludedIds.length > 0) {
        const result = await this.caseRepo.find({
          where: {
            id: Not(In(excludedIds)),
            status: 'published' as const,
            deleted_at: IsNull(),
          },
          order: { like_count: 'DESC' },
          take: Math.ceil(limit * 0.3),
        });
        sameColorCases.push(...result);
        excludedIds.push(...result.map((c) => Number(c.id)));
      }

      // Layer 3: Hot platform-wide cases (30% weight)
      const hotCases: Case[] = [];
      if (excludedIds.length > 0) {
        const result = await this.caseRepo.find({
          where: {
            id: Not(In(excludedIds)),
            status: 'published' as const,
            deleted_at: IsNull(),
          },
          order: { like_count: 'DESC', view_count: 'DESC' },
          take: limit,
        });
        hotCases.push(...result);
      }

      // Combine and dedup
      const allRecommended = [...sameStoreCases, ...sameColorCases, ...hotCases];

      if (storeId) {
        // Boost same-store cases
        (allRecommended as RecommendedCase[]).forEach((c) => {
          c._boosted = Number(c.store_id) === storeId;
        });
        (allRecommended as RecommendedCase[]).sort((a, b) => {
          const aBoost = a._boosted ? 1 : 0;
          const bBoost = b._boosted ? 1 : 0;
          return bBoost - aBoost;
        });
      }

      // Take first `limit` unique items
      const seen = new Set<number>();
      const results: Case[] = [];
      for (const c of allRecommended) {
        if (!seen.has(Number(c.id)) && results.length < limit) {
          seen.add(Number(c.id));
          results.push(c);
        }
      }

      return results.map((c) => ({
        id: Number(c.id),
        title: c.title,
        cover_image_url: c.cover_image_url ?? '',
        vehicle_summary: c.title,
        like_count: c.like_count,
        match_reason: Number(c.store_id) === Number(currentCase.store_id) ? '同门店案例' : '热门推荐',
      }));
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      this.logger.error('Recommendation engine error', error instanceof Error ? error.stack : undefined);
      throw new BusinessException(ErrorCode.RECOMMENDATION_ENGINE_ERROR, '推荐引擎暂时不可用，请稍后再试');
    }
  }
}
