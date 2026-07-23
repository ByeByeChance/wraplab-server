import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Quote } from '../quote/entities/quote.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Customer } from '../customer/entities/customer.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { CsvExportDto } from '../admin/dto/csv-export.dto';

@Injectable()
export class CsvExportService {
  private readonly MAX_ROWS = parseInt(process.env.CSV_EXPORT_MAX_ROWS || '10000', 10);

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async estimateRowCount(dataType: string, dateFrom: string, dateTo: string, storeId: number): Promise<number> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    switch (dataType) {
      case 'quotes':
        return this.quoteRepo.count({
          where: { store_id: storeId, created_at: Between(from, to) },
        });
      case 'appointments':
        return this.appointmentRepo.count({
          where: {
            store_id: storeId,
            appointment_date: Between(dateFrom as unknown as string, dateTo as unknown as string),
          },
        });
      case 'customers':
        return this.customerRepo.count({
          where: { store_id: storeId, created_at: Between(from, to) },
        });
      default:
        return 0;
    }
  }

  async validateExport(dto: CsvExportDto, storeId: number): Promise<void> {
    const estimatedRows = await this.estimateRowCount(dto.data_type, dto.date_from, dto.date_to, storeId);

    if (estimatedRows > this.MAX_ROWS) {
      throw new BusinessException(ErrorCode.EXPORT_ROW_LIMIT_EXCEEDED, '导出数据超过上限（10,000行），请缩小范围');
    }
  }

  async generateCsv(dto: CsvExportDto, storeId: number): Promise<string> {
    const from = new Date(dto.date_from);
    const to = new Date(dto.date_to);

    let headers: string[];
    let rows: Record<string, unknown>[];

    switch (dto.data_type) {
      case 'quotes': {
        headers = ['报价单号', '原价', '成交价', '状态', '创建时间'];
        const quotes = await this.quoteRepo.find({
          where: {
            store_id: storeId,
            created_at: Between(from, to),
          },
          take: this.MAX_ROWS,
        });
        rows = quotes.map((q) => ({
          报价单号: String(q.id),
          原价: q.total_price?.toString() ?? '0.00',
          成交价: q.final_price?.toString() ?? '0.00',
          状态: q.status,
          创建时间: q.created_at?.toISOString() ?? '',
        }));
        break;
      }

      case 'appointments': {
        headers = ['预约号', '客户姓名', '手机号', '预约日期', '时段', '服务类型', '状态', '创建时间'];
        const appointments = await this.appointmentRepo.find({
          where: {
            store_id: storeId,
            appointment_date: Between(dto.date_from as unknown as string, dto.date_to as unknown as string),
          },
          take: this.MAX_ROWS,
        });
        rows = appointments.map((a) => ({
          预约号: String(a.id),
          客户姓名: a.customer_name,
          手机号: a.customer_phone,
          预约日期: String(a.appointment_date),
          时段: a.time_slot,
          服务类型: a.service_type,
          状态: a.status,
          创建时间: a.created_at?.toISOString() ?? '',
        }));
        break;
      }

      case 'customers': {
        headers = ['姓名', '手机号', '来源', '累计订单', '创建时间'];
        const customers = await this.customerRepo.find({
          where: {
            store_id: storeId,
            created_at: Between(from, to),
          },
          take: this.MAX_ROWS,
        });
        rows = customers.map((c) => ({
          姓名: c.name,
          手机号: c.phone,
          来源: c.source,
          累计订单: String(c.total_orders),
          创建时间: c.created_at?.toISOString() ?? '',
        }));
        break;
      }

      default:
        headers = [];
        rows = [];
    }

    // Build CSV with BOM for Excel compatibility
    const bom = '﻿';
    const csvLines = [headers.map((h) => this.escapeCsvField(h)).join(',')];

    for (const row of rows) {
      const values = headers.map((h) => this.escapeCsvField(String(row[h] ?? '')));
      csvLines.push(values.join(','));
    }

    return bom + csvLines.join('\n');
  }

  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
