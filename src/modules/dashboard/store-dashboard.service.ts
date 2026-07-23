import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreDashboardDto } from '../admin/dto/store-dashboard.dto';

@Injectable()
export class StoreDashboardService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async getSingleStore(storeId: number, period: string, date?: string): Promise<StoreDashboardDto> {
    const store = await this.storeRepo.findOne({ where: { id: storeId, deleted_at: IsNull() } });
    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '门店不存在');
    }

    const { periodStart, periodEnd } = this.calculatePeriod(period, date);

    // Use independent subqueries to avoid Cartesian product
    const quoteStats = await this.quoteRepo
      .createQueryBuilder('q')
      .select('COALESCE(SUM(CASE WHEN q.status = :closed THEN q.final_price ELSE 0 END), 0)', 'total_revenue')
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
      .andWhere('q.created_at BETWEEN :periodStart AND :periodEnd', { periodStart, periodEnd })
      .andWhere('q.deleted_at IS NULL')
      .setParameters({ closed: 'closed' })
      .getRawOne();

    const appointmentStats = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'appointment_count')
      .addSelect(
        'ROUND(COUNT(DISTINCT CASE WHEN a.status = :arrived THEN a.id END) * 100.0 / NULLIF(COUNT(*), 0), 1)',
        'arrival_rate',
      )
      .where('a.store_id = :storeId', { storeId })
      .andWhere('a.appointment_date BETWEEN :periodStart AND :periodEnd', { periodStart, periodEnd })
      .andWhere('a.deleted_at IS NULL')
      .setParameters({ arrived: 'arrived' })
      .getRawOne();

    const customerStats = await this.customerRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'new_customer_count')
      .where('c.store_id = :storeId', { storeId })
      .andWhere('c.created_at BETWEEN :periodStart AND :periodEnd', { periodStart, periodEnd })
      .andWhere('c.deleted_at IS NULL')
      .getRawOne();

    // Top staff by revenue
    const topStaff = await this.quoteRepo
      .createQueryBuilder('q')
      .select('q.staff_id', 'staff_id')
      .addSelect('SUM(q.final_price)', 'revenue')
      .where('q.store_id = :storeId', { storeId })
      .andWhere('q.status = :closed', { closed: 'closed' })
      .andWhere('q.created_at BETWEEN :periodStart AND :periodEnd', { periodStart, periodEnd })
      .andWhere('q.deleted_at IS NULL')
      .groupBy('q.staff_id')
      .orderBy('revenue', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      total_revenue: Number(quoteStats?.total_revenue ?? 0),
      quote_count: Number(quoteStats?.quote_count ?? 0),
      conversion_rate: Number(quoteStats?.conversion_rate ?? 0),
      appointment_count: Number(appointmentStats?.appointment_count ?? 0),
      arrival_rate: Number(appointmentStats?.arrival_rate ?? 0),
      new_customer_count: Number(customerStats?.new_customer_count ?? 0),
      average_order_value: Number(quoteStats?.average_order_value ?? 0),
      top_staff: topStaff.map((s) => ({
        staff_id: Number(s.staff_id),
        name: `员工${s.staff_id}`,
        revenue: Number(s.revenue ?? 0),
      })),
    };
  }

  private calculatePeriod(period: string, date?: string): { periodStart: Date; periodEnd: Date } {
    const now = date ? new Date(date) : new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek + 1); // Monday
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { periodStart: start, periodEnd: end };
  }
}
