import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { HeatmapDataPointDto } from '../admin/dto/heatmap-query.dto';

@Injectable()
export class HeatmapService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
  ) {}

  async generate(dateFrom: string, dateTo: string, _aggregation: 'grid' | 'city'): Promise<HeatmapDataPointDto[]> {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      throw new BusinessException(
        ErrorCode.HEATMAP_DATE_RANGE_TOO_LARGE,
        '热力图日期范围过大（最多 365 天），请缩小范围',
      );
    }

    // Aggregate by store_id as proxy for location density
    const result = await this.quoteRepo
      .createQueryBuilder('q')
      .select('q.store_id', 'store_id')
      .addSelect('COUNT(*)', 'density')
      .where('q.created_at BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('q.store_id')
      .orderBy('density', 'DESC')
      .getRawMany();

    return result.map((r) => ({
      density: Number(r.density),
    }));
  }
}
