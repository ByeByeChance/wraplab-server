import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { DashboardComparisonResponseDto } from '../admin/dto/dashboard-comparison.dto';

@Injectable()
export class DashboardComparisonService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async compare(
    storeId: number,
    compareType: 'yoy' | 'mom',
    period: string,
    date?: string,
  ): Promise<DashboardComparisonResponseDto> {
    const now = date ? new Date(date) : new Date();
    const [currentStart, currentEnd] = this.calculatePeriodBounds(period, now);
    let previousStart: Date;
    let previousEnd: Date;

    if (compareType === 'mom') {
      [previousStart, previousEnd] = this.shiftBackOnePeriod(period, currentStart);
    } else {
      previousStart = new Date(currentStart);
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      previousEnd = new Date(currentEnd);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
    }

    const currentMetrics = await this.aggregateMetrics(storeId, currentStart, currentEnd);
    const previousMetrics = await this.aggregateMetrics(storeId, previousStart, previousEnd);

    const calcGrowth = (current: number, previous: number): number | null => {
      if (previous > 0) {
        return Math.round(((current - previous) / previous) * 10000) / 100;
      }
      return null;
    };

    return {
      revenue: {
        current: currentMetrics.revenue,
        previous: previousMetrics.revenue,
        growth_pct: calcGrowth(currentMetrics.revenue, previousMetrics.revenue),
      },
      quote_count: {
        current: currentMetrics.quote_count,
        previous: previousMetrics.quote_count,
        growth_pct: calcGrowth(currentMetrics.quote_count, previousMetrics.quote_count),
      },
      appointment_count: {
        current: currentMetrics.appointment_count,
        previous: previousMetrics.appointment_count,
        growth_pct: calcGrowth(currentMetrics.appointment_count, previousMetrics.appointment_count),
      },
      conversion_rate: {
        current: currentMetrics.conversion_rate,
        previous: previousMetrics.conversion_rate,
        growth_pct: calcGrowth(currentMetrics.conversion_rate, previousMetrics.conversion_rate),
      },
      new_customer_count: {
        current: currentMetrics.new_customer_count,
        previous: previousMetrics.new_customer_count,
        growth_pct: calcGrowth(currentMetrics.new_customer_count, previousMetrics.new_customer_count),
      },
      average_order_value: {
        current: currentMetrics.average_order_value,
        previous: previousMetrics.average_order_value,
        growth_pct: calcGrowth(currentMetrics.average_order_value, previousMetrics.average_order_value),
      },
      period_label: `${this.formatPeriodLabel(period, currentStart)} vs ${this.formatPeriodLabel(period, previousStart)}`,
    };
  }

  private async aggregateMetrics(
    storeId: number,
    start: Date,
    end: Date,
  ): Promise<{
    revenue: number;
    quote_count: number;
    conversion_rate: number;
    average_order_value: number;
    appointment_count: number;
    new_customer_count: number;
  }> {
    const quoteStats = await this.quoteRepo
      .createQueryBuilder('q')
      .select('COALESCE(SUM(CASE WHEN q.status = :closed THEN q.final_price ELSE 0 END), 0)', 'revenue')
      .addSelect('COUNT(*)', 'quote_count')
      .addSelect(
        'ROUND(COUNT(DISTINCT CASE WHEN q.status = :closed THEN q.id END) * 100.0 / NULLIF(COUNT(*), 0), 1)',
        'conversion_rate',
      )
      .addSelect(
        'ROUND(COALESCE(SUM(CASE WHEN q.status = :closed THEN q.final_price ELSE 0 END), 0) / NULLIF(COUNT(DISTINCT CASE WHEN q.status = :closed THEN q.id END), 0), 2)',
        'average_order_value',
      )
      .where('q.store_id = :storeId', { storeId })
      .andWhere('q.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('q.deleted_at IS NULL')
      .setParameters({ closed: 'closed' })
      .getRawOne();

    const appointmentStats = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'appointment_count')
      .where('a.store_id = :storeId', { storeId })
      .andWhere('a.appointment_date BETWEEN :start AND :end', { start, end })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    const customerStats = await this.customerRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'new_customer_count')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('c.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('c.deleted_at IS NULL')
      .getRawOne();

    return {
      revenue: Number(quoteStats?.revenue ?? 0),
      quote_count: Number(quoteStats?.quote_count ?? 0),
      conversion_rate: Number(quoteStats?.conversion_rate ?? 0),
      average_order_value: Number(quoteStats?.average_order_value ?? 0),
      appointment_count: Number(appointmentStats?.appointment_count ?? 0),
      new_customer_count: Number(customerStats?.new_customer_count ?? 0),
    };
  }

  private calculatePeriodBounds(period: string, date: Date): [Date, Date] {
    const start = new Date(date);
    const end = new Date(date);

    if (period === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else {
      // quarterly
      const quarter = Math.floor(start.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(quarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
    }

    return [start, end];
  }

  private shiftBackOnePeriod(period: string, fromDate: Date): [Date, Date] {
    const start = new Date(fromDate);

    if (period === 'monthly') {
      start.setMonth(start.getMonth() - 1);
    } else {
      start.setMonth(start.getMonth() - 3);
    }

    return this.calculatePeriodBounds(period, start);
  }

  private formatPeriodLabel(period: string, date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (period === 'monthly') {
      return `${year}年${month}月`;
    }
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${year}年Q${quarter}`;
  }
}
