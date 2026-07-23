import { Controller, Post, Get, Param, Body, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ShareService } from './share.service';
import { ShareDto } from './dto/share.dto';

@Controller('cases')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get(':id/share-card')
  async getShareCardData(@Param('id', ParseIntPipe) id: number) {
    return this.shareService.getShareCardData(id);
  }

  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async recordShare(@Param('id', ParseIntPipe) id: number, @Body() dto: ShareDto) {
    return this.shareService.recordShare(id, dto);
  }
}
