import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';
import { Favorite } from './entities/favorite.entity';
import { Configuration } from '../configuration/entities/configuration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Configuration])],
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
