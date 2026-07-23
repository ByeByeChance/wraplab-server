import { Controller, Get, Put, Body } from '@nestjs/common';
import { StoreService } from './store.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateStoreDto } from './dto/store.dto';

@Controller('admin/store')
@Roles('manager', 'admin')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  async getMyStore() {
    return this.storeService.getMyStore();
  }

  @Put()
  async updateMyStore(@Body() dto: UpdateStoreDto) {
    return this.storeService.updateMyStore(dto);
  }
}
