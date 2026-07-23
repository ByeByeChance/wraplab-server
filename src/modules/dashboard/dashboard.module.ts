import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { ExportController } from './export.controller';
import { DashboardService } from './dashboard.service';
import { StoreDashboardService } from './store-dashboard.service';
import { StoreComparisonService } from './store-comparison.service';
import { DashboardComparisonService } from './dashboard-comparison.service';
import { DrillDownService } from './drill-down.service';
import { HeatmapService } from './heatmap.service';
import { ScheduledExportService } from './scheduled-export.service';
import { CsvExportService } from './csv-export.service';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { CampaignClaim } from '../campaign/entities/campaign-claim.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Store } from '../store/entities/store.entity';
import { ScheduledExport } from './entities/scheduled-export.entity';
import { ScheduledExportLog } from './entities/scheduled-export-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, Appointment, CampaignClaim, Customer, Store, ScheduledExport, ScheduledExportLog]),
  ],
  controllers: [DashboardController, AdminDashboardController, ExportController],
  providers: [
    DashboardService,
    StoreDashboardService,
    StoreComparisonService,
    DashboardComparisonService,
    DrillDownService,
    HeatmapService,
    ScheduledExportService,
    CsvExportService,
  ],
  exports: [DashboardService, StoreDashboardService],
})
export class DashboardModule {}
