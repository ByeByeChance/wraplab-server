import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { Case } from '../case/entities/case.entity';
import { Store } from '../store/entities/store.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Store])],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
