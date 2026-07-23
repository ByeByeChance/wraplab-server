import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';
import { Case } from '../case/entities/case.entity';
import { QueryRankingDto, RankingPeriod } from './dto/query-ranking.dto';

/**
 * Ranking service.
 *
 * NOTE: The ranking is intentionally public/cross-store — it serves as a
 * platform-wide leaderboard visible to all stores. Per-store rankings are
 * NOT currently scoped. If per-store rankings are needed in the future,
 * add `store_id` filtering in the query where clause and consider adding
 * a `storeId` parameter to QueryRankingDto.
 */
@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
  ) {}

  async getRanking(query: QueryRankingDto): Promise<{
    list: Case[];
    total: number;
    page: number;
    size: number;
    period: string;
    type: string;
  }> {
    const { start } = this.getDateRange(query.period);

    const [list, total] = await this.caseRepo.findAndCount({
      where: {
        status: 'published',
        deleted_at: IsNull(),
        created_at: MoreThanOrEqual(start) as unknown as Date,
      },
      order: { [query.type]: 'DESC' },
      skip: query.skip,
      take: query.take,
    });

    return {
      list,
      total,
      page: query.page ?? 1,
      size: query.size ?? 20,
      period: query.period,
      type: query.type,
    };
  }

  private getDateRange(period: RankingPeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = now;

    switch (period) {
      case 'daily': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: yesterday, end: yesterdayEnd };
      }
      case 'weekly': {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday as start
        startOfWeek.setDate(startOfWeek.getDate() - diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return { start: startOfWeek, end };
      }
      case 'monthly': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start: startOfMonth, end };
      }
    }
  }
}
