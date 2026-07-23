import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { StoreDashboardService } from './store-dashboard.service';
import { StoreComparisonService } from './store-comparison.service';
import { DashboardComparisonService } from './dashboard-comparison.service';
import { DrillDownService } from './drill-down.service';
import { HeatmapService } from './heatmap.service';
import { StoreDashboardQueryDto, StoreComparisonQueryDto } from '../admin/dto/store-dashboard.dto';
import { DashboardComparisonQueryDto } from '../admin/dto/dashboard-comparison.dto';
import { DrillDownQueryDto } from '../admin/dto/drill-down.dto';
import { HeatmapQueryDto } from '../admin/dto/heatmap-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('admin')
export class AdminDashboardController {
  constructor(
    private readonly storeDashboardService: StoreDashboardService,
    private readonly storeComparisonService: StoreComparisonService,
    private readonly dashboardComparisonService: DashboardComparisonService,
    private readonly drillDownService: DrillDownService,
    private readonly heatmapService: HeatmapService,
  ) {}

  @Get('stores/:id/dashboard')
  @Roles('admin', 'manager')
  async getStoreDashboard(@Param('id', ParseIntPipe) id: number, @Query() query: StoreDashboardQueryDto) {
    return this.storeDashboardService.getSingleStore(id, query.period, query.date);
  }

  @Get('stores/comparison')
  @Roles('admin')
  async compareStores(@Query() query: StoreComparisonQueryDto) {
    const storeIds = query.store_ids.split(',').map(Number);
    return this.storeComparisonService.compare(storeIds, query.period, query.date);
  }

  @Get('dashboard/comparison')
  @Roles('admin', 'manager')
  async getDashboardComparison(@Query() query: DashboardComparisonQueryDto, @CurrentUser() user: JwtPayload) {
    return this.dashboardComparisonService.compare(user.store_id ?? 0, query.compare_type, query.period, query.date);
  }

  @Get('dashboard/drill-down')
  @Roles('admin', 'manager')
  async drillDown(@Query() query: DrillDownQueryDto, @CurrentUser() user: JwtPayload) {
    return this.drillDownService.getDetails(
      user.store_id ?? 0,
      query.metric_type,
      query.period,
      query.date,
      query.group_by,
      query.page ?? 1,
      query.size ?? 20,
    );
  }

  @Get('stores/heatmap')
  @Roles('admin')
  async getHeatmap(@Query() query: HeatmapQueryDto) {
    return this.heatmapService.generate(query.date_from, query.date_to, query.aggregation);
  }
}
