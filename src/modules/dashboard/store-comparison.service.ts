import { Injectable } from '@nestjs/common';
import { StoreDashboardService } from './store-dashboard.service';
import { StoreComparisonDto } from '../admin/dto/store-dashboard.dto';

@Injectable()
export class StoreComparisonService {
  constructor(private readonly storeDashboardService: StoreDashboardService) {}

  async compare(storeIds: number[], period: string, date?: string): Promise<StoreComparisonDto> {
    // Query each store independently
    const items = await Promise.all(
      storeIds.map((storeId) => this.storeDashboardService.getSingleStore(storeId, period, date)),
    );

    const validItems = items.filter((item) => item.quote_count > 0 || item.appointment_count > 0);

    if (validItems.length === 0) {
      return {
        items,
        platform_average: {
          revenue_avg: 0,
          conversion_rate_avg: 0,
          arrival_rate_avg: 0,
        },
      };
    }

    const count = validItems.length;
    const revenueAvg = validItems.reduce((sum, i) => sum + i.total_revenue, 0) / count;
    const conversionAvg = validItems.reduce((sum, i) => sum + i.conversion_rate, 0) / count;
    const arrivalAvg = validItems.reduce((sum, i) => sum + i.arrival_rate, 0) / count;

    return {
      items,
      platform_average: {
        revenue_avg: Math.round(revenueAvg * 100) / 100,
        conversion_rate_avg: Math.round(conversionAvg * 100) / 100,
        arrival_rate_avg: Math.round(arrivalAvg * 100) / 100,
      },
    };
  }
}
