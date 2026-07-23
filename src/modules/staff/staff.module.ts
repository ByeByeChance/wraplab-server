import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffStoreController } from './staff-store.controller';
import { StaffService } from './staff.service';
import { StaffMultiStoreService } from './staff-multi-store.service';
import { Staff } from './entities/staff.entity';
import { StaffStore } from './entities/staff-store.entity';
import { Store } from '../store/entities/store.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, StaffStore, Store])],
  controllers: [StaffController, StaffStoreController],
  providers: [StaffService, StaffMultiStoreService],
  exports: [StaffService, StaffMultiStoreService],
})
export class StaffModule {}
