import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { Quote } from './entities/quote.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { PartColor } from '../configuration/entities/part-color.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, Configuration, PartColor])],
  controllers: [QuoteController],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
