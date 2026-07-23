import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Staff } from '../staff/entities/staff.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Store } from '../store/entities/store.entity';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    HttpModule,
    TypeOrmModule.forFeature([Staff, StaffStore, Store]),
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenGuard],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
