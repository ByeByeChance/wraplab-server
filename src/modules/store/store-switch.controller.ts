import { Controller, Get, Post, Body } from '@nestjs/common';
import { StoreSwitchService } from './store-switch.service';
import { SwitchStoreDto } from './dto/switch-store.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller()
export class StoreSwitchController {
  constructor(private readonly storeSwitchService: StoreSwitchService) {}

  @Post('stores/switch')
  async switch(@Body() dto: SwitchStoreDto, @CurrentUser() user: JwtPayload) {
    return this.storeSwitchService.switch(user.sub, dto.target_store_id, user.jti, user.exp);
  }

  @Get('stores/current')
  async getCurrent(@CurrentUser() user: JwtPayload) {
    return this.storeSwitchService.getCurrentStoreInfo(user.sub);
  }
}
