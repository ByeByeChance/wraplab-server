import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseController } from './case.controller';
import { CaseRecommendationController } from './case-recommendation.controller';
import { TagController } from './tag.controller';
import { CaseService } from './case.service';
import { CaseRecommendationService } from './case-recommendation.service';
import { CaseTagService } from './case-tag.service';
import { Case } from './entities/case.entity';
import { CaseLike } from './entities/case-like.entity';
import { CaseTag } from './entities/case-tag.entity';
import { CaseTagRelation } from './entities/case-tag-relation.entity';
import { Configuration } from '../configuration/entities/configuration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseLike, CaseTag, CaseTagRelation, Configuration])],
  controllers: [CaseController, CaseRecommendationController, TagController],
  providers: [CaseService, CaseRecommendationService, CaseTagService],
  exports: [CaseService, CaseTagService],
})
export class CaseModule {}
