import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { DrillDownItemDto } from '../admin/dto/drill-down.dto';

@Injectable()
export class DrillDownService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getDetails(
    storeId: number,
    metricType: string,
    period: string,
    date: string | undefined,
    groupBy: string,
    page: number,
    size: number,
  ): Promise<{ items: DrillDownItemDto[]; total: number }> {
    const { startDate, endDate } = this.calculatePeriod(period, date);
    const skip = (page - 1) * size;

    let items: DrillDownItemDto[] = [];
    let total = 0;

    switch (metricType) {
      case 'revenue': {
        if (groupBy !== 'staff') break;
        const qb = this.quoteRepo
          .createQueryBuilder('q')
          .select('q.staff_id', 'dimension_value')
          .addSelect('SUM(q.final_price)', 'metric_value')
          .where('q.store_id = :storeId', { storeId })
          .andWhere('q.status = :closed', { closed: 'closed' })
          .andWhere('q.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
          .andWhere('q.deleted_at IS NULL')
          .groupBy('q.staff_id')
          .orderBy('metric_value', 'DESC');

        const countQb = qb.clone();
        const countResult = await countQb.getRawMany();
        total = countResult.length;

        const result = await qb.offset(skip).limit(size).getRawMany();
        items = result.map((r) => ({
          dimension_value: `员工${r.dimension_value}`,
          metric_value: Number(r.metric_value ?? 0),
        }));
        break;
      }

      case 'quotes': {
        if (groupBy !== 'brand') break;
        // Aggregate by brand through configuration chain
        const result = await this.quoteRepo
          .createQueryBuilder('q')
          .select('cb.name', 'dimension_value')
          .addSelect('COUNT(DISTINCT q.id)', 'metric_value')
          .leftJoin('configuration', 'cfg', 'cfg.id = q.configuration_id')
          .leftJoin('car_model', 'cm', 'cm.id = cfg.model_id')
          .leftJoin('car_series', 'cs', 'cs.id = cm.series_id')
          .leftJoin('car_brand', 'cb', 'cb.id = cs.brand_id')
          .where('q.store_id = :storeId', { storeId })
          .andWhere('q.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
          .andWhere('q.deleted_at IS NULL')
          .groupBy('cb.id, cb.name')
          .orderBy('metric_value', 'DESC')
          .getRawMany();

        total = result.length;
        items = result.map((r) => ({
          dimension_value: r.dimension_value ?? '未知品牌',
          metric_value: Number(r.metric_value ?? 0),
        }));
        break;
      }

      case 'appointments': {
        if (groupBy !== 'day') break;
        const result = await this.appointmentRepo
          .createQueryBuilder('a')
          .select('a.appointment_date', 'dimension_value')
          .addSelect('COUNT(*)', 'metric_value')
          .where('a.store_id = :storeId', { storeId })
          .andWhere('a.appointment_date BETWEEN :start AND :end', { start: startDate, end: endDate })
          .andWhere('a.deleted_at IS NULL')
          .groupBy('a.appointment_date')
          .orderBy('a.appointment_date', 'ASC')
          .getRawMany();

        total = result.length;
        items = result.map((r) => ({
          dimension_value: String(r.dimension_value),
          metric_value: Number(r.metric_value ?? 0),
        }));
        break;
      }

      case 'customers': {
        if (groupBy !== 'service_type') break;
        const result = await this.customerRepo
          .createQueryBuilder('c')
          .select("COALESCE(q.service_type, '无服务记录')", 'dimension_value')
          .addSelect('COUNT(DISTINCT c.id)', 'metric_value')
          .leftJoin('quote', 'q', 'q.customer_phone = c.phone AND q.store_id = c.store_id AND q.deleted_at IS NULL')
          .where('c.store_id = :storeId', { storeId })
          .andWhere('c.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
          .andWhere('c.deleted_at IS NULL')
          .groupBy('q.service_type')
          .getRawMany();

        total = result.length;
        items = result.map((r) => ({
          dimension_value: r.dimension_value,
          metric_value: Number(r.metric_value ?? 0),
        }));
        break;
      }
    }

    // Calculate percentages
    const sum = items.reduce((acc, item) => acc + item.metric_value, 0);
    if (sum > 0) {
      items = items.map((item) => ({
        ...item,
        percentage: Math.round((item.metric_value / sum) * 10000) / 100,
      }));
    }

    return { items, total };
  }

  private calculatePeriod(period: string, date?: string): { startDate: Date; endDate: Date } {
    const now = date ? new Date(date) : new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (period === 'monthly') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else {
      // weekly
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  }
}
