import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarBrand } from '../modules/vehicle/entities/car-brand.entity';
import { CarSeries } from '../modules/vehicle/entities/car-series.entity';
import { CarModel } from '../modules/vehicle/entities/car-model.entity';
import { ColorBrand } from '../modules/color/entities/color-brand.entity';
import { ColorSwatch } from '../modules/color/entities/color-swatch.entity';
import { Material } from '../modules/color/entities/material.entity';
import { Configuration } from '../modules/configuration/entities/configuration.entity';
import { PartColor } from '../modules/configuration/entities/part-color.entity';
import { Quote } from '../modules/quote/entities/quote.entity';
import { Store } from '../modules/store/entities/store.entity';
import { Staff } from '../modules/staff/entities/staff.entity';
import { CarPart } from '../modules/vehicle/entities/car-part.entity';
import { Case } from '../modules/case/entities/case.entity';
import { CaseLike } from '../modules/case/entities/case-like.entity';
import { Favorite } from '../modules/favorite/entities/favorite.entity';
import { AiGeneration } from '../modules/ai/entities/ai-generation.entity';
import { SmsCode } from '../modules/sms/entities/sms-code.entity';
import { StoreLocation } from '../modules/store-location/entities/store-location.entity';
import { Appointment } from '../modules/appointment/entities/appointment.entity';
import { Campaign } from '../modules/campaign/entities/campaign.entity';
import { CampaignClaim } from '../modules/campaign/entities/campaign-claim.entity';
import { Customer } from '../modules/customer/entities/customer.entity';
// Phase 5 entities
import { StaffStore } from '../modules/staff/entities/staff-store.entity';
import { AppointmentWaitlist } from '../modules/appointment/entities/appointment-waitlist.entity';
import { ServiceTypeConfig } from '../modules/appointment/entities/service-type-config.entity';
import { StoreServiceConfig } from '../modules/appointment/entities/store-service-config.entity';
import { CaseTag } from '../modules/case/entities/case-tag.entity';
import { CaseTagRelation } from '../modules/case/entities/case-tag-relation.entity';
import { ScheduledExport } from '../modules/dashboard/entities/scheduled-export.entity';
import { ScheduledExportLog } from '../modules/dashboard/entities/scheduled-export-log.entity';
import { UsdzConversionLog } from '../modules/vehicle/entities/usdz-conversion-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DB_TYPE', 'mysql');
        const isSqlite = dbType === 'sqljs' || dbType === 'sqlite' || dbType === 'better-sqlite3';

        const baseConfig: any = {
          type: dbType,
          entities: [
            CarBrand,
            CarSeries,
            CarModel,
            ColorBrand,
            ColorSwatch,
            Material,
            Configuration,
            PartColor,
            Quote,
            Store,
            Staff,
            CarPart,
            Case,
            CaseLike,
            Favorite,
            AiGeneration,
            SmsCode,
            StoreLocation,
            Appointment,
            Campaign,
            CampaignClaim,
            Customer,
            // Phase 5
            StaffStore,
            AppointmentWaitlist,
            ServiceTypeConfig,
            StoreServiceConfig,
            CaseTag,
            CaseTagRelation,
            ScheduledExport,
            ScheduledExportLog,
            UsdzConversionLog,
          ],
          synchronize: false, // Use migrations only
          logging: configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn', 'query'] : ['error', 'warn'],
          maxQueryExecutionTime: 500, // log slow queries (>500ms)
        };

        if (isSqlite) {
          return {
            ...baseConfig,
            database: ':memory:',
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          charset: 'utf8mb4',
          timezone: '+08:00',
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
