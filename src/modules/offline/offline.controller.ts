import { Controller, Get, Query } from '@nestjs/common';
import { OfflineManifestService } from './offline-manifest.service';
import { OfflineManifestQueryDto } from './dto/offline-manifest.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('offline')
export class OfflineController {
  constructor(private readonly offlineManifestService: OfflineManifestService) {}

  @Get('manifest')
  async getManifest(@Query() query: OfflineManifestQueryDto, @CurrentUser() user: JwtPayload) {
    return this.offlineManifestService.generate(user.store_id ?? 0, query.since);
  }
}
