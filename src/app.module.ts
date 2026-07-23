import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { ColorModule } from './modules/color/color.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { QuoteModule } from './modules/quote/quote.module';
import { StoreModule } from './modules/store/store.module';
import { StaffModule } from './modules/staff/staff.module';
import { FileModule } from './modules/file/file.module';
import { CaseModule } from './modules/case/case.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { AiModule } from './modules/ai/ai.module';
import { SmsModule } from './modules/sms/sms.module';
import { QueueModule } from './modules/queue/queue.module';
import { WsModule } from './modules/ws/ws.module';
import { StoreLocationModule } from './modules/store-location/store-location.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { CustomerModule } from './modules/customer/customer.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CommentModule } from './modules/comment/comment.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { ShareModule } from './modules/share/share.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ArModule } from './modules/ar/ar.module';
import { AdminModule } from './modules/admin/admin.module';
import { OfflineModule } from './modules/offline/offline.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { RateLimitLoggingGuard } from './common/guards/rate-limit-logging.guard';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    RedisModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
      },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CryptoModule,
    QueueModule,
    AuthModule,
    VehicleModule,
    ColorModule,
    ConfigurationModule,
    QuoteModule,
    StoreModule,
    StaffModule,
    FileModule,
    CaseModule,
    FavoriteModule,
    AiModule,
    SmsModule,
    WsModule,
    StoreLocationModule,
    AppointmentModule,
    CampaignModule,
    CustomerModule,
    DashboardModule,
    CommentModule,
    RankingModule,
    ShareModule,
    WebhookModule,
    ArModule,
    AdminModule,
    OfflineModule,
    HealthModule,
  ],
  providers: [
    // Global JWT auth guard (public endpoints skip via @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard (enforces @Roles() decorators). Must run AFTER JwtAuthGuard.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global throttler guard with rate-limit logging (public endpoints override limits via @Throttle())
    {
      provide: APP_GUARD,
      useClass: RateLimitLoggingGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global interceptors (ordered: Logging -> Tenant -> Response)
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    // Global validation pipe
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
  ],
})
export class AppModule {}
