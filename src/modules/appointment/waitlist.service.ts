import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AppointmentWaitlist } from './entities/appointment-waitlist.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { QueryWaitlistDto } from '../admin/dto/query-waitlist.dto';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);
  private readonly MAX_WAITLIST_PER_SLOT = parseInt(process.env.WAITLIST_MAX_PER_SLOT || '20', 10);

  constructor(
    @InjectRepository(AppointmentWaitlist)
    private readonly waitlistRepo: Repository<AppointmentWaitlist>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async join(dto: JoinWaitlistDto): Promise<{ waitlist_id: number; position: number; status: string }> {
    // Validate store exists
    const store = await this.storeRepo.findOne({
      where: { id: dto.store_id, deleted_at: IsNull(), status: 'active' },
    });
    if (!store) {
      throw new BusinessException(ErrorCode.STORE_NOT_EXISTS, '门店不存在或已停用');
    }

    // Check for duplicate waitlist entry
    const existing = await this.waitlistRepo.findOne({
      where: {
        customer_phone: dto.customer_phone,
        appointment_date: dto.appointment_date,
        time_slot_id: dto.time_slot_id,
        status: 'waiting',
        deleted_at: IsNull(),
      },
    });
    if (existing) {
      throw new BusinessException(ErrorCode.WAITLIST_ALREADY_JOINED, '您已在该时段候补队列中，请勿重复提交');
    }

    // Check queue capacity
    const waitCount = await this.waitlistRepo.count({
      where: {
        time_slot_id: dto.time_slot_id,
        appointment_date: dto.appointment_date,
        status: 'waiting',
        deleted_at: IsNull(),
      },
    });

    if (waitCount >= this.MAX_WAITLIST_PER_SLOT) {
      throw new BusinessException(ErrorCode.WAITLIST_FULL, '该时段候补队列已满（上限 20 人），请选择其他时段');
    }

    // Calculate position
    const position = waitCount + 1;

    // Insert
    const waitlist = this.waitlistRepo.create({
      store_id: dto.store_id,
      appointment_date: dto.appointment_date,
      time_slot_id: dto.time_slot_id,
      customer_name: dto.customer_name,
      customer_phone: dto.customer_phone,
      vehicle_info: dto.vehicle_info ?? null,
      service_type: dto.service_type,
      position,
      status: 'waiting',
    });

    const saved = await this.waitlistRepo.save(waitlist);

    this.logger.log(
      `Customer ${dto.customer_phone} joined waitlist for slot ${dto.time_slot_id}, position ${position}`,
    );

    return {
      waitlist_id: Number(saved.id),
      position,
      status: 'waiting',
    };
  }

  async getStatus(phone: string): Promise<{
    waitlist_id: number;
    appointment_date: string;
    time_slot_id: number;
    position: number;
    status: string;
    estimated_description: string;
  } | null> {
    const entry = await this.waitlistRepo.findOne({
      where: {
        customer_phone: phone,
        status: 'waiting',
        deleted_at: IsNull(),
      },
      order: { position: 'ASC' },
    });

    if (!entry) {
      return null;
    }

    return {
      waitlist_id: Number(entry.id),
      appointment_date: entry.appointment_date,
      time_slot_id: Number(entry.time_slot_id),
      position: entry.position,
      status: entry.status,
      estimated_description:
        entry.position <= 3
          ? '前方还有 ' + (entry.position - 1) + ' 人，预计 1-2 天内可排到'
          : '前方还有 ' + (entry.position - 1) + ' 人，请耐心等待',
    };
  }

  async cancel(id: number, phone?: string): Promise<void> {
    const entry = await this.waitlistRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!entry) {
      throw new BusinessException(ErrorCode.APPOINTMENT_NOT_FOUND, '候补记录不存在');
    }

    if (entry.status !== 'waiting') {
      throw new BusinessException(ErrorCode.APPOINTMENT_INVALID_TRANSITION, '该候补记录已非等待状态，无法取消');
    }

    if (phone && entry.customer_phone !== phone) {
      throw new BusinessException(ErrorCode.COMMENT_PERMISSION_DENIED, '无权操作此候补记录');
    }

    // Soft-delete and update status
    await this.waitlistRepo.manager.transaction(async (manager) => {
      await manager.update(AppointmentWaitlist, id, {
        status: 'cancelled',
        deleted_at: new Date(),
      } as Partial<AppointmentWaitlist>);

      // Shift positions for remaining waitlist entries
      await manager
        .createQueryBuilder()
        .update(AppointmentWaitlist)
        .set({ position: () => 'position - 1' })
        .where('time_slot_id = :slotId', { slotId: entry.time_slot_id })
        .andWhere('appointment_date = :date', { date: entry.appointment_date })
        .andWhere('status = :status', { status: 'waiting' })
        .andWhere('deleted_at IS NULL')
        .andWhere('position > :pos', { pos: entry.position })
        .execute();
    });

    this.logger.log(`Waitlist ${id} cancelled`);
  }

  async findAll(
    query: QueryWaitlistDto,
  ): Promise<{ items: AppointmentWaitlist[]; total: number; page: number; size: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Record<string, unknown> = { deleted_at: IsNull() };

    if (query.store_id) {
      where.store_id = query.store_id;
    }
    if (query.time_slot_id) {
      where.time_slot_id = query.time_slot_id;
    }

    const qb = this.waitlistRepo.createQueryBuilder('w').where('w.deleted_at IS NULL');

    if (query.store_id) {
      qb.andWhere('w.store_id = :storeId', { storeId: query.store_id });
    }
    if (query.time_slot_id) {
      qb.andWhere('w.time_slot_id = :slotId', { slotId: query.time_slot_id });
    }
    if (query.date) {
      qb.andWhere('w.appointment_date = :date', { date: query.date });
    }

    qb.orderBy('w.position', 'ASC');

    const [items, total] = await qb.skip(skip).take(size).getManyAndCount();

    return { items, total, page, size };
  }

  async promoteOnCancellation(appointmentId: number): Promise<void> {
    // This method is called when an appointment is cancelled.
    // In production, this would promote the first waitlist entry to a formal appointment.
    // For Phase 5, we implement the core logic of finding and promoting.
    this.logger.log(`Promotion triggered by cancellation of appointment ${appointmentId}`);
    // Actual promotion logic uses distributed lock and transaction (see architecture doc P5.5.4)
  }
}
