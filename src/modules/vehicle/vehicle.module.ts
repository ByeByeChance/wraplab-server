import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleController } from './vehicle.controller';
import { AdminVehicleController } from './admin-vehicle.controller';
import { UsdzController } from './usdz.controller';
import { VehicleService } from './vehicle.service';
import { UsdzService } from './usdz.service';
import { CarBrand } from './entities/car-brand.entity';
import { CarSeries } from './entities/car-series.entity';
import { CarModel } from './entities/car-model.entity';
import { CarPart } from './entities/car-part.entity';
import { UsdzConversionLog } from './entities/usdz-conversion-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CarBrand, CarSeries, CarModel, CarPart, UsdzConversionLog])],
  controllers: [VehicleController, AdminVehicleController, UsdzController],
  providers: [VehicleService, UsdzService],
  exports: [VehicleService, UsdzService],
})
export class VehicleModule {}
