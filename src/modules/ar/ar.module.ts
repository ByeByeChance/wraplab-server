import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { Configuration } from '../configuration/entities/configuration.entity';
import { CarModel } from '../vehicle/entities/car-model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Configuration, CarModel])],
  controllers: [ArController],
  providers: [ArService],
  exports: [ArService],
})
export class ArModule {}
