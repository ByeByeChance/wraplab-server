import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerSubscriber } from './customer.subscriber';
import { Customer } from './entities/customer.entity';
import { Staff } from '../staff/entities/staff.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Staff])],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerSubscriber],
  exports: [CustomerService],
})
export class CustomerModule {}
