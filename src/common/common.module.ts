import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

@Global()
@Module({
  providers: [
    JwtAuthGuard,
    RolesGuard,
    TenantInterceptor,
    LoggingInterceptor,
    ResponseTransformInterceptor,
    AllExceptionsFilter,
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    TenantInterceptor,
    LoggingInterceptor,
    ResponseTransformInterceptor,
    AllExceptionsFilter,
  ],
})
export class CommonModule {}
