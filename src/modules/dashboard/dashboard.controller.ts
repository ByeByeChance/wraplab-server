import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DashboardService, DashboardOverview, TrendData, TopStoreData, TopCampaignData } from './dashboard.service';
import { DashboardTrendsQueryDto, DashboardTopQueryDto } from './dto/dashboard.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/dashboard')
@Roles('manager', 'admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(): Promise<DashboardOverview> {
    return this.dashboardService.getOverview();
  }

  @Get('trends')
  async getTrends(@Query() query: DashboardTrendsQueryDto): Promise<TrendData[]> {
    return this.dashboardService.getTrends(query.startDate, query.endDate, query.granularity);
  }

  @Get('top-stores')
  async getTopStores(@Query() query: DashboardTopQueryDto): Promise<TopStoreData[]> {
    return this.dashboardService.getTopStores(query.limit);
  }

  @Get('top-campaigns')
  async getTopCampaigns(@Query() query: DashboardTopQueryDto): Promise<TopCampaignData[]> {
    return this.dashboardService.getTopCampaigns(query.limit);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async export(@Body('dateRange') dateRange: { start: string; end: string }, @Body('metrics') metrics: string[]) {
    return this.dashboardService.exportDashboard(dateRange, metrics || []);
  }
}
