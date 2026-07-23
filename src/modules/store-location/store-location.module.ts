import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreLocationController } from './store-location.controller';
import { StoreLocationService } from './store-location.service';
import { StoreLocation } from './entities/store-location.entity';
import { Store } from '../store/entities/store.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreLocation, Store])],
  controllers: [StoreLocationController],
  providers: [StoreLocationService],
  exports: [StoreLocationService],
})
export class StoreLocationModule {}
