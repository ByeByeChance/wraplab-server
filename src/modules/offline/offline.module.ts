import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineController } from './offline.controller';
import { OfflineManifestService } from './offline-manifest.service';
import { Case } from '../case/entities/case.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';
import { ColorBrand } from '../color/entities/color-brand.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, CarModel, ColorSwatch, ColorBrand])],
  controllers: [OfflineController],
  providers: [OfflineManifestService],
})
export class OfflineModule {}
