import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Appointment, validateTransition, TimeSlot } from './entities/appointment.entity';
import { Store } from '../store/entities/store.entity';
import { SmsService } from '../sms/sms.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { PaginationDto } from '../../common/dto/pagination.dto';

const MAX_APPOINTMENTS_PER_SLOT = 20;

const SERVICE_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
];

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly eventEmitter: EventEmitter2,
    private readonly smsService: SmsService,
  ) {}

  async create(dto: {
    store_id: number;
    customer_name: string;
    customer_phone: string;
    service_type: string;
    appointment_date: string;
    time_slot: TimeSlot;
    vehicle_info?: Record<string, unknown>;
    remark?: string;
  }): Promise<Appointment> {
    // Check store active
    const store = await this.storeRepo.findOne({ where: { id: dto.store_id } });
    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_FOUND, 'Store not found');
    }
    if (store.status !== 'active') {
      throw new BusinessException(ErrorCode.APPOINTMENT_STORE_INACTIVE, 'Store is not active');
    }

    // Capacity check and insert inside transaction for atomicity.
    // Return the created appointment from the transaction to avoid a non-null assertion.
    const appointment = await this.appointmentRepo.manager.transaction(async (manager) => {
      const countResult = await manager
        .createQueryBuilder(Appointment, 'a')
        .select('COUNT(*)', 'cnt')
        .where('a.store_id = :storeId', { storeId: dto.store_id })
        .andWhere('a.appointment_date = :date', { date: dto.appointment_date })
        .andWhere('a.time_slot = :slot', { slot: dto.time_slot })
        .andWhere('a.status NOT IN (:...statuses)', {
          statuses: ['cancelled'],
        })
        .setLock('pessimistic_write')
        .getRawOne();

      const count = Number(countResult?.cnt ?? 0);
      if (count >= MAX_APPOINTMENTS_PER_SLOT) {
        throw new BusinessException(ErrorCode.APPOINTMENT_CAPACITY_EXCEEDED, 'Time slot fully booked');
      }

      const appt = manager.create(Appointment, dto);
      return manager.save(appt);
    });

    return appointment;
  }

  async confirm(id: number): Promise<Appointment> {
    const storeId = StoreContext.getStoreId() as number;
    const appointment = await this.appointmentRepo.findOne({
      where: { id, store_id: storeId },
    });
    if (!appointment) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, 'Appointment not found');
    }

    if (!validateTransition(appointment.status, 'confirmed')) {
      throw new BusinessException(
        ErrorCode.APPOINTMENT_INVALID_TRANSITION,
        `Cannot confirm appointment from status: ${appointment.status}`,
      );
    }

    appointment.status = 'confirmed';
    const saved = await this.appointmentRepo.save(appointment);

    this.eventEmitter.emit('appointment.confirmed', {
      store_id: appointment.store_id,
      customer_name: appointment.customer_name,
      customer_phone: appointment.customer_phone,
    });

    return saved;
  }

  async cancel(id: number, reason: string): Promise<Appointment> {
    const storeId = StoreContext.getStoreId() as number;
    const appointment = await this.appointmentRepo.findOne({
      where: { id, store_id: storeId },
    });
    if (!appointment) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, 'Appointment not found');
    }

    if (!validateTransition(appointment.status, 'cancelled')) {
      throw new BusinessException(
        ErrorCode.APPOINTMENT_INVALID_TRANSITION,
        `Cannot cancel appointment from status: ${appointment.status}`,
      );
    }

    appointment.status = 'cancelled';
    appointment.cancel_reason = reason;
    return this.appointmentRepo.save(appointment);
  }

  async reschedule(id: number, dto: { appointment_date: string; time_slot: TimeSlot }): Promise<Appointment> {
    const storeId = StoreContext.getStoreId() as number;
    const appointment = await this.appointmentRepo.findOne({
      where: { id, store_id: storeId },
    });
    if (!appointment) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, 'Appointment not found');
    }

    // Only confirmed appointments can be rescheduled
    if (appointment.status !== 'confirmed') {
      throw new BusinessException(
        ErrorCode.APPOINTMENT_INVALID_TRANSITION,
        'Only confirmed appointments can be rescheduled',
      );
    }

    // Check capacity for the new slot
    const count = await this.appointmentRepo.count({
      where: {
        store_id: appointment.store_id,
        appointment_date: dto.appointment_date,
        time_slot: dto.time_slot,
        status: In(['pending', 'confirmed']),
      },
    });

    if (count >= MAX_APPOINTMENTS_PER_SLOT) {
      throw new BusinessException(ErrorCode.APPOINTMENT_CAPACITY_EXCEEDED, 'Target time slot fully booked');
    }

    appointment.appointment_date = dto.appointment_date;
    appointment.time_slot = dto.time_slot;
    return this.appointmentRepo.save(appointment);
  }

  async findSlots(storeId: number, date: string): Promise<{ slots: { time_slot: string; available: number }[] }> {
    const slots: string[] = ['MORNING', 'AFTERNOON', 'EVENING'];
    const result: { time_slot: string; available: number }[] = [];

    for (const slot of slots) {
      const count = await this.appointmentRepo.count({
        where: {
          store_id: storeId,
          appointment_date: date,
          time_slot: slot as Appointment['time_slot'],
          status: In(['pending', 'confirmed']),
        },
      });
      result.push({
        time_slot: slot,
        available: Math.max(0, MAX_APPOINTMENTS_PER_SLOT - count),
      });
    }

    return { slots: result };
  }

  getServiceTypes() {
    return SERVICE_TYPES;
  }

  async findMine(
    pagination: PaginationDto,
  ): Promise<{ list: Appointment[]; total: number; page: number; size: number }> {
    const storeId = StoreContext.getStoreId() as number;

    const [list, total] = await this.appointmentRepo.findAndCount({
      where: { store_id: storeId },
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<{ list: Appointment[]; total: number; page: number; size: number }> {
    const [list, total] = await this.appointmentRepo.findAndCount({
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async sendVerifyCode(appointmentId: number): Promise<{ expires_at: string }> {
    const storeId = StoreContext.getStoreId() as number;

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId, store_id: storeId },
    });

    if (!appointment) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, '预约不存在');
    }

    return this.smsService.sendCode({
      phone: appointment.customer_phone,
      type: 'appointment',
    });
  }

  async verifyCode(appointmentId: number, code: string): Promise<{ verified: boolean }> {
    const storeId = StoreContext.getStoreId() as number;

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId, store_id: storeId },
    });

    if (!appointment) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, '预约不存在');
    }

    await this.smsService.verifyCode(appointment.customer_phone, code, 'appointment');

    return { verified: true };
  }
}
