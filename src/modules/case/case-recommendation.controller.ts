import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { CaseRecommendationService } from './case-recommendation.service';
import { CaseRecommendationQueryDto } from './dto/case-recommendation.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class CaseRecommendationController {
  constructor(private readonly caseRecommendationService: CaseRecommendationService) {}

  @Public()
  @Get('cases/:id/recommendations')
  async getRecommendations(@Param('id', ParseIntPipe) id: number, @Query() query: CaseRecommendationQueryDto) {
    return this.caseRecommendationService.recommend(id, query.limit, query.store_id);
  }
}
