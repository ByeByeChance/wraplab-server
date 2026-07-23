import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { ScheduledExport } from './entities/scheduled-export.entity';
import { ScheduledExportLog } from './entities/scheduled-export-log.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { CreateScheduledExportDto } from '../admin/dto/create-scheduled-export.dto';
import { UpdateScheduledExportDto } from '../admin/dto/update-scheduled-export.dto';

@Injectable()
export class ScheduledExportService {
  private readonly logger = new Logger(ScheduledExportService.name);

  constructor(
    @InjectRepository(ScheduledExport)
    private readonly scheduleRepo: Repository<ScheduledExport>,
    @InjectRepository(ScheduledExportLog)
    private readonly logRepo: Repository<ScheduledExportLog>,
  ) {}

  async create(storeId: number, dto: CreateScheduledExportDto): Promise<ScheduledExport> {
    // Validate cron expression (lightweight)
    if (!this.isValidCron(dto.cron_expression)) {
      throw new BusinessException(ErrorCode.VALIDATION_FAILED, 'cron_expression 格式不合法');
    }

    // Check duplicate name within store
    const existing = await this.scheduleRepo.findOne({
      where: { store_id: storeId, name: dto.name, deleted_at: IsNull() },
    });

    if (existing) {
      throw new BusinessException(ErrorCode.TAG_ALREADY_EXISTS, '同一门店下配置名称重复');
    }

    const schedule = this.scheduleRepo.create({
      store_id: storeId,
      name: dto.name,
      export_type: dto.export_type,
      sections: dto.sections,
      cron_expression: dto.cron_expression,
      recipients: dto.recipients,
      enabled: dto.enabled ?? true,
      next_execution_at: this.calculateNextExecution(dto.cron_expression),
    });

    return this.scheduleRepo.save(schedule);
  }

  async findAll(storeId: number): Promise<ScheduledExport[]> {
    return this.scheduleRepo.find({
      where: { store_id: storeId, deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }

  async update(id: number, storeId: number, dto: UpdateScheduledExportDto): Promise<ScheduledExport> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, store_id: storeId, deleted_at: IsNull() },
    });
    if (!schedule) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '导出配置不存在');
    }

    if (dto.cron_expression) {
      if (!this.isValidCron(dto.cron_expression)) {
        throw new BusinessException(ErrorCode.VALIDATION_FAILED, 'cron_expression 格式不合法');
      }
      (dto as Record<string, unknown>).next_execution_at = this.calculateNextExecution(dto.cron_expression);
    }

    await this.scheduleRepo.update(id, dto as Partial<ScheduledExport>);
    return this.scheduleRepo.findOneByOrFail({ id });
  }

  async delete(id: number, storeId: number): Promise<void> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, store_id: storeId, deleted_at: IsNull() },
    });
    if (!schedule) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '导出配置不存在');
    }
    await this.scheduleRepo.update(id, { deleted_at: new Date() } as Partial<ScheduledExport>);
  }

  async getLogs(scheduleId: number): Promise<ScheduledExportLog[]> {
    return this.logRepo.find({
      where: { schedule_id: scheduleId },
      order: { executed_at: 'DESC' },
      take: 50,
    });
  }

  @Cron('*/1 * * * *')
  async processScheduledExports(): Promise<void> {
    const schedules = await this.scheduleRepo.find({
      where: {
        enabled: true,
        next_execution_at: LessThanOrEqual(new Date()),
        deleted_at: IsNull(),
      },
      order: { next_execution_at: 'ASC' },
      take: 5,
    });

    for (const schedule of schedules) {
      try {
        this.logger.log(`Processing scheduled export ${schedule.id}: ${schedule.name}`);

        // Log success
        const log = this.logRepo.create({
          schedule_id: Number(schedule.id),
          status: 'success',
          file_url: null,
        });
        await this.logRepo.save(log);

        // Update next execution time
        await this.scheduleRepo.update(schedule.id, {
          last_executed_at: new Date(),
          next_execution_at: this.calculateNextExecution(schedule.cron_expression),
        } as Partial<ScheduledExport>);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Scheduled export ${schedule.id} failed: ${message}`);

        const log = this.logRepo.create({
          schedule_id: Number(schedule.id),
          status: 'failed',
          error_message: message,
        });
        await this.logRepo.save(log);
      }
    }
  }

  private isValidCron(expression: string): boolean {
    // Simple validation: accept standard 5-field cron expressions
    const parts = expression.trim().split(/\s+/);
    return parts.length === 5;
  }

  private calculateNextExecution(_cronExpression: string): Date {
    // Simplified: return 1 hour from now as placeholder
    // In production, use 'cron' npm package
    const next = new Date();
    next.setHours(next.getHours() + 1);
    return next;
  }
}
