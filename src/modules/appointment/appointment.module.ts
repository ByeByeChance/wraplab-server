import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { WaitlistController } from './waitlist.controller';
import { ServiceConfigController } from './service-config.controller';
import { WaitlistService } from './waitlist.service';
import { TimeSlotCapacityService } from './time-slot-capacity.service';
import { Appointment } from './entities/appointment.entity';
import { AppointmentWaitlist } from './entities/appointment-waitlist.entity';
import { ServiceTypeConfig } from './entities/service-type-config.entity';
import { StoreServiceConfig } from './entities/store-service-config.entity';
import { Store } from '../store/entities/store.entity';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentWaitlist, ServiceTypeConfig, StoreServiceConfig, Store]),
    SmsModule,
  ],
  controllers: [AppointmentController, WaitlistController, ServiceConfigController],
  providers: [AppointmentService, WaitlistService, TimeSlotCapacityService],
  exports: [AppointmentService, WaitlistService, TimeSlotCapacityService],
})
export class AppointmentModule {}
