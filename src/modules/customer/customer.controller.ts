import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreContext } from '../../common/context/store-context';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

@Controller('admin/customers')
@Roles('manager', 'admin')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async findAll(@Query() pagination: PaginationDto, @Query('keyword') keyword?: string) {
    return this.customerService.findAll(pagination, keyword);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findById(id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BusinessException(ErrorCode.CUSTOMER_IMPORT_INVALID_FORMAT, 'No file uploaded');
    }

    const storeId = StoreContext.getStoreId() as number;
    const csvContent = file.buffer.toString('utf-8');
    return this.customerService.importCsv(storeId, csvContent);
  }

  // --- P4.5: Customer Management Extensions ---

  @Put(':id/bind-staff')
  @HttpCode(HttpStatus.OK)
  async bindStaff(@Param('id', ParseIntPipe) id: number, @Body('staffId') staffId: number) {
    return this.customerService.bindStaff(id, staffId);
  }

  @Put(':id/unbind-staff')
  @HttpCode(HttpStatus.OK)
  async unbindStaff(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.unbindStaff(id);
  }

  @Post('merge')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async mergeCustomers(@Body('primaryId') primaryId: number, @Body('secondaryIds') secondaryIds: number[]) {
    return this.customerService.mergeCustomers(primaryId, secondaryIds);
  }

  @Get('duplicates')
  @Roles('admin')
  async findDuplicates(@Query('limit', ParseIntPipe) limit: number = 50) {
    return this.customerService.findDuplicates(limit);
  }

  @Get('reminders')
  @Roles('manager', 'admin')
  async getReminders(@Query('days', ParseIntPipe) days: number = 3) {
    return this.customerService.getReminders(days);
  }

  // --- P4.12: Customer Migration ---

  @Post('migrate/confirm')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async migrateConfirm(
    @Body('fromStoreId') fromStoreId: number,
    @Body('toStoreId') toStoreId: number,
    @Body('customerIds') customerIds?: number[],
  ) {
    return this.customerService.migrateConfirm(fromStoreId, toStoreId, customerIds);
  }

  @Post('migrate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async migrate(
    @Body('fromStoreId') fromStoreId: number,
    @Body('toStoreId') toStoreId: number,
    @Body('customerIds') customerIds: number[],
    @Body('confirmToken') _confirmToken: string,
  ) {
    return this.customerService.migrate(fromStoreId, toStoreId, customerIds);
  }
}
