import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreController } from './store.controller';
import { StoreSwitchController } from './store-switch.controller';
import { StoreService } from './store.service';
import { StoreSwitchService } from './store-switch.service';
import { Store } from './entities/store.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StaffStore, Staff]), JwtModule.register({})],
  controllers: [StoreController, StoreSwitchController],
  providers: [StoreService, StoreSwitchService],
  exports: [StoreService, StoreSwitchService],
})
export class StoreModule {}
