import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { CampaignClaim } from '../campaign/entities/campaign-claim.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';

export interface DashboardOverview {
  today_revenue: number;
  today_orders: number;
  today_appointments: number;
}

export interface TrendData {
  date: string;
  revenue: number;
  orders: number;
  appointments: number;
}

export interface TopStoreData {
  store_id: number;
  revenue: number;
  order_count: number;
}

export interface TopCampaignData {
  campaign_id: number;
  usage_count: number;
  total_discount: number;
}

/**
 * Simple in-memory cache for dashboard queries.
 * TODO: Replace with Redis Cache-Aside pattern:
 *   1. On read: check Redis -> if miss, query DB, store in Redis with 5-min TTL
 *   2. On write (quote create/update): invalidate affected cache keys
 *   3. Use Redis SET ... EX for automatic TTL expiration
 */
@Injectable()
export class DashboardService {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(CampaignClaim)
    private readonly claimRepo: Repository<CampaignClaim>,
  ) {}

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  async getOverview(): Promise<DashboardOverview> {
    const cached = this.getFromCache<DashboardOverview>('dashboard:overview');
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const storeId = StoreContext.getStoreId();

    const quoteQuery = this.quoteRepo
      .createQueryBuilder('q')
      .select('COALESCE(SUM(q.total_price), 0)', 'revenue')
      .addSelect('COUNT(q.id)', 'count')
      .where('q.created_at >= :today', { today })
      .andWhere('q.created_at < :tomorrow', { tomorrow })
      .andWhere('q.deleted_at IS NULL');

    const apptWhere: Record<string, unknown> = { created_at: Between(today, tomorrow) };

    // Multi-tenant: scope to store_id when context is set (non-admin users)
    if (storeId !== null) {
      quoteQuery.andWhere('q.store_id = :storeId', { storeId });
      apptWhere['store_id'] = storeId;
    }

    const [todayOrders, todayAppointments] = await Promise.all([
      quoteQuery.getRawOne(),
      this.appointmentRepo.count({ where: apptWhere }),
    ]);

    const result: DashboardOverview = {
      today_revenue: Number(todayOrders?.revenue ?? 0),
      today_orders: Number(todayOrders?.count ?? 0),
      today_appointments: todayAppointments,
    };

    this.setCache('dashboard:overview', result);
    return result;
  }

  async getTrends(startDate: string, endDate: string, granularity: string = 'day'): Promise<TrendData[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      throw new BusinessException(ErrorCode.DASHBOARD_QUERY_TOO_LONG, 'Date range cannot exceed 90 days');
    }

    const cacheKey = `dashboard:trends:${startDate}:${endDate}:${granularity}`;
    const cached = this.getFromCache<TrendData[]>(cacheKey);
    if (cached) return cached;

    const format = granularity === 'month' ? '%Y-%m' : granularity === 'week' ? '%Y-%u' : '%Y-%m-%d';

    const storeId = StoreContext.getStoreId();

    const quoteQuery = this.quoteRepo
      .createQueryBuilder('q')
      .select(`DATE_FORMAT(q.created_at, '${format}')`, 'date')
      .addSelect('COALESCE(SUM(q.total_price), 0)', 'revenue')
      .addSelect('COUNT(q.id)', 'orders')
      .where('q.created_at >= :start', { start })
      .andWhere('q.created_at <= :end', { end })
      .andWhere('q.deleted_at IS NULL');

    const apptQuery = this.appointmentRepo
      .createQueryBuilder('a')
      .select(`DATE_FORMAT(a.created_at, '${format}')`, 'date')
      .addSelect('COUNT(a.id)', 'appointments')
      .where('a.created_at >= :start', { start })
      .andWhere('a.created_at <= :end', { end });

    // Multi-tenant: scope to store_id when context is set (non-admin users)
    if (storeId !== null) {
      quoteQuery.andWhere('q.store_id = :storeId', { storeId });
      apptQuery.andWhere('a.store_id = :storeId', { storeId });
    }

    const [quoteStats, appointmentStats] = await Promise.all([
      quoteQuery.groupBy('date').orderBy('date', 'ASC').getRawMany(),
      apptQuery.groupBy('date').orderBy('date', 'ASC').getRawMany(),
    ]);

    const apptMap = new Map<string, number>();
    for (const row of appointmentStats) {
      apptMap.set(row.date, Number(row.appointments));
    }

    const trends: TrendData[] = quoteStats.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      appointments: apptMap.get(row.date) ?? 0,
    }));

    this.setCache(cacheKey, trends);
    return trends;
  }

  async getTopStores(limit: number): Promise<TopStoreData[]> {
    const cached = this.getFromCache<TopStoreData[]>(`dashboard:top-stores:${limit}`);
    if (cached) return cached;

    const results = await this.quoteRepo
      .createQueryBuilder('q')
      .select('q.store_id', 'store_id')
      .addSelect('COALESCE(SUM(q.total_price), 0)', 'revenue')
      .addSelect('COUNT(q.id)', 'order_count')
      .where('q.deleted_at IS NULL')
      .groupBy('q.store_id')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany();

    const data: TopStoreData[] = results.map((r) => ({
      store_id: Number(r.store_id),
      revenue: Number(r.revenue),
      order_count: Number(r.order_count),
    }));

    this.setCache(`dashboard:top-stores:${limit}`, data);
    return data;
  }

  async getTopCampaigns(limit: number): Promise<TopCampaignData[]> {
    const cached = this.getFromCache<TopCampaignData[]>(`dashboard:top-campaigns:${limit}`);
    if (cached) return cached;

    const results = await this.claimRepo
      .createQueryBuilder('cc')
      .select('cc.campaign_id', 'campaign_id')
      .addSelect('COUNT(cc.id)', 'usage_count')
      .addSelect('COALESCE(SUM(cc.discount_amount), 0)', 'total_discount')
      .groupBy('cc.campaign_id')
      .orderBy('usage_count', 'DESC')
      .limit(limit)
      .getRawMany();

    const data: TopCampaignData[] = results.map((r) => ({
      campaign_id: Number(r.campaign_id),
      usage_count: Number(r.usage_count),
      total_discount: Number(r.total_discount),
    }));

    this.setCache(`dashboard:top-campaigns:${limit}`, data);
    return data;
  }

  // --- P4.11: Dashboard Export ---

  private exportRateLimitMap = new Map<string, number>();

  async exportDashboard(
    dateRange: { start: string; end: string },
    metrics: string[],
  ): Promise<{ taskId: string; status: string; data: Record<string, unknown> }> {
    const storeId = StoreContext.getStoreId() as number;

    // Rate limit: 5 min per store
    const key = `export:${storeId}`;
    const now = Date.now();
    const lastExport = this.exportRateLimitMap.get(key) || 0;
    if (now - lastExport < 5 * 60 * 1000) {
      throw new BusinessException(ErrorCode.EXPORT_RATE_LIMITED, '导出请求过于频繁，请5分钟后再试');
    }
    this.exportRateLimitMap.set(key, now);

    const data: Record<string, unknown> = {};

    if (metrics.includes('overview') || metrics.length === 0) {
      data.overview = await this.getOverview();
    }
    if (metrics.includes('trends')) {
      data.trends = await this.getTrends(dateRange.start, dateRange.end, 'day');
    }
    if (metrics.includes('top_stores')) {
      data.top_stores = await this.getTopStores(10);
    }
    if (metrics.includes('top_campaigns')) {
      data.top_campaigns = await this.getTopCampaigns(10);
    }

    return {
      taskId: `export_${storeId}_${Date.now()}`,
      status: 'completed',
      data,
    };
  }
}
