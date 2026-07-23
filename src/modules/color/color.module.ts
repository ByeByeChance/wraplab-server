import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorController } from './color.controller';
import { AdminColorController } from './admin-color.controller';
import { ColorService } from './color.service';
import { ColorBrand } from './entities/color-brand.entity';
import { ColorSwatch } from './entities/color-swatch.entity';
import { Material } from './entities/material.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ColorBrand, ColorSwatch, Material])],
  controllers: [ColorController, AdminColorController],
  providers: [ColorService],
  exports: [ColorService],
})
export class ColorModule {}
