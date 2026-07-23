import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreAdminController } from './store-admin.controller';
import { StoreAdminService } from './store-admin.service';
import { Store } from '../store/entities/store.entity';
import { StaffStore } from '../staff/entities/staff-store.entity';
import { Staff } from '../staff/entities/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StaffStore, Staff])],
  controllers: [StoreAdminController],
  providers: [StoreAdminService],
  exports: [StoreAdminService],
})
export class AdminModule {}
