import { Controller, Get, Query } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { QueryRankingDto } from './dto/query-ranking.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('cases')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Public()
  @Get('ranking')
  async getRanking(@Query() query: QueryRankingDto) {
    return this.rankingService.getRanking(query);
  }
}
