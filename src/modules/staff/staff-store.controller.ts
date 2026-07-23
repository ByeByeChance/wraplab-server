import { Controller, Get, Put, Param, Body, ParseIntPipe } from '@nestjs/common';
import { StaffMultiStoreService } from './staff-multi-store.service';
import { UpdateStaffStoresDto } from './dto/update-staff-stores.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class StaffStoreController {
  constructor(private readonly staffMultiStoreService: StaffMultiStoreService) {}

  @Get('staff/me/stores')
  async getMyStores(@CurrentUser() user: JwtPayload) {
    return this.staffMultiStoreService.getStaffStores(user.sub, user.store_id ?? undefined);
  }

  @Get('admin/staff/:id/stores')
  @Roles('admin', 'manager')
  async getStaffStores(@Param('id', ParseIntPipe) id: number) {
    return this.staffMultiStoreService.getStaffStores(id);
  }

  @Put('admin/staff/:id/stores')
  @Roles('admin')
  async assignStores(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffStoresDto) {
    await this.staffMultiStoreService.assignStores(id, dto.store_ids, dto.roles);
    return { success: true };
  }

  @Get('admin/stores/:id/staff')
  @Roles('admin', 'manager')
  async getStoreStaff(@Param('id', ParseIntPipe) id: number) {
    return this.staffMultiStoreService.getStoreStaff(id);
  }
}
