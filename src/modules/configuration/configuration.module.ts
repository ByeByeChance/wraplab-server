import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { Configuration } from './entities/configuration.entity';
import { PartColor } from './entities/part-color.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';
import { ColorSwatch } from '../color/entities/color-swatch.entity';
import { Material } from '../color/entities/material.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Configuration, PartColor, CarModel, ColorSwatch, Material])],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
