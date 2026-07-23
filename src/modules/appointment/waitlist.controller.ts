import { Controller, Post, Get, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { QueryWaitlistDto } from '../admin/dto/query-waitlist.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Post('appointments/waitlist')
  async join(@Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(dto);
  }

  @Public()
  @Get('appointments/waitlist/status')
  async getStatus(@Query('phone') phone: string) {
    return this.waitlistService.getStatus(phone);
  }

  @Delete('appointments/waitlist/:id')
  async cancel(@Param('id', ParseIntPipe) id: number, @Query('phone') phone?: string) {
    await this.waitlistService.cancel(id, phone);
    return { success: true };
  }

  @Get('admin/appointments/waitlist')
  @Roles('admin', 'manager')
  async findAll(@Query() query: QueryWaitlistDto) {
    return this.waitlistService.findAll(query);
  }
}
