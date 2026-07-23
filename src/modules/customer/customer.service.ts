import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { Staff } from '../staff/entities/staff.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}

  /**
   * INSERT ... ON DUPLICATE KEY UPDATE pattern.
   * Atomic upsert — no race condition on uk_store_phone.
   */
  async upsertByPhone(storeId: number, phone: string, data: { name: string; source?: string }): Promise<Customer> {
    await this.customerRepo
      .createQueryBuilder()
      .insert()
      .into(Customer)
      .values({
        store_id: storeId,
        phone,
        name: data.name,
        source: (data.source as Customer['source']) ?? 'appointment',
        total_orders: 0,
      })
      .orUpdate(['name', 'source'], ['store_id', 'phone'], {
        skipUpdateIfNoValuesChanged: true,
      })
      .execute();

    return this.customerRepo.findOneOrFail({
      where: { store_id: storeId, phone },
    });
  }

  async findAll(
    pagination: PaginationDto,
    keyword?: string,
  ): Promise<{ list: Customer[]; total: number; page: number; size: number }> {
    const storeId = StoreContext.getStoreId() as number;

    const where: Record<string, unknown> = { store_id: storeId };
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }

    const [list, total] = await this.customerRepo.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async findById(id: number): Promise<Customer> {
    const storeId = StoreContext.getStoreId() as number;
    const customer = await this.customerRepo.findOne({
      where: { id, store_id: storeId },
    });
    if (!customer) {
      throw new BusinessException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }
    return customer;
  }

  /**
   * Import customers from CSV string.
   * Max 10MB and 5000 rows.
   */
  async importCsv(storeId: number, csvContent: string): Promise<{ imported: number; skipped: number }> {
    // Size check (approximate byte count)
    const byteSize = Buffer.byteLength(csvContent, 'utf-8');
    if (byteSize > 10 * 1024 * 1024) {
      throw new BusinessException(ErrorCode.CUSTOMER_IMPORT_TOO_LARGE, 'CSV file exceeds 10MB limit');
    }

    const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

    // Max rows (excluding header)
    if (lines.length > 5001) {
      throw new BusinessException(ErrorCode.CUSTOMER_IMPORT_TOO_LARGE, 'CSV exceeds 5000 rows limit');
    }

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) {
        skipped++;
        continue;
      }

      const [name, phone] = cols;
      if (!name || !phone) {
        skipped++;
        continue;
      }

      try {
        await this.upsertByPhone(storeId, phone, { name, source: 'import' });
        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // --- P4.5: Customer Management Extensions ---

  async bindStaff(customerId: number, staffId: number): Promise<Customer> {
    const storeId = StoreContext.getStoreId() as number;

    // Validate staff belongs to the same store
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, store_id: storeId },
    });
    if (!staff) {
      throw new BusinessException(ErrorCode.STAFF_NOT_IN_STORE, '店员不属于本门店');
    }

    const customer = await this.findById(customerId);
    customer.assigned_staff_id = staffId;
    return this.customerRepo.save(customer);
  }

  async unbindStaff(customerId: number): Promise<Customer> {
    const customer = await this.findById(customerId);
    customer.assigned_staff_id = null;
    return this.customerRepo.save(customer);
  }

  async mergeCustomers(primaryId: number, secondaryIds: number[]): Promise<Customer> {
    const storeId = StoreContext.getStoreId() as number;

    const primary = await this.customerRepo.findOne({
      where: { id: primaryId, store_id: storeId },
    });
    if (!primary) {
      throw new BusinessException(ErrorCode.MERGE_INVALID_PRIMARY, '主客户不存在');
    }

    // Merge: aggregate total_orders and keep primary's data
    const secondaryCustomers = await this.customerRepo.find({
      where: { id: In(secondaryIds), store_id: storeId },
    });

    let mergedOrders = primary.total_orders;
    for (const sc of secondaryCustomers) {
      mergedOrders += sc.total_orders;
    }

    primary.total_orders = mergedOrders;

    // Soft-delete secondary customers — apply merged name using application-level logic
    // to avoid MySQL-specific CONCAT() raw SQL, ensuring database portability.
    for (const sc of secondaryCustomers) {
      const mergedName = `${sc.name}_merged_${sc.id}`;
      await this.customerRepo.update({ id: sc.id, store_id: storeId }, {
        name: mergedName,
        deleted_at: new Date(),
      } as Partial<Customer>);
    }

    return this.customerRepo.save(primary);
  }

  async findDuplicates(limit: number = 50): Promise<{ duplicates: { phone: string; customers: Customer[] }[] }> {
    // Find phones that appear in multiple stores
    const duplicates = await this.customerRepo
      .createQueryBuilder('c')
      .select('c.phone', 'phone')
      .addSelect('COUNT(DISTINCT c.store_id)', 'storeCount')
      .addSelect('GROUP_CONCAT(c.id)', 'ids')
      .groupBy('c.phone')
      .having('storeCount > 1')
      .limit(limit)
      .getRawMany();

    const result: { phone: string; customers: Customer[] }[] = [];

    for (const dup of duplicates) {
      const ids = (dup.ids as string).split(',').map(Number);
      const customers = await this.customerRepo.find({
        where: { id: In(ids) },
        order: { created_at: 'ASC' },
      });
      result.push({ phone: dup.phone, customers });
    }

    return { duplicates: result };
  }

  async getReminders(days: number = 3): Promise<Customer[]> {
    const storeId = StoreContext.getStoreId() as number;
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const todayStr = today.toISOString().slice(5, 10); // MM-DD
    const futureStr = future.toISOString().slice(5, 10);

    return this.customerRepo
      .createQueryBuilder('c')
      .where('c.store_id = :storeId', { storeId })
      .andWhere(
        '(DATE_FORMAT(c.birthday, "%m-%d") BETWEEN :today AND :future OR DATE_FORMAT(c.anniversary_date, "%m-%d") BETWEEN :today AND :future)',
        { today: todayStr, future: futureStr },
      )
      .orderBy('c.birthday', 'ASC')
      .getMany();
  }

  // --- P4.12: Customer Migration ---

  async migrateConfirm(
    fromStoreId: number,
    toStoreId: number,
    customerIds?: number[],
  ): Promise<{ confirmToken: string; summary: { count: number; fromStoreId: number; toStoreId: number } }> {
    const where: Record<string, unknown> = { store_id: fromStoreId };
    if (customerIds && customerIds.length > 0) {
      where.id = In(customerIds);
    }

    const count = await this.customerRepo.count({ where });

    // Generate a simple confirm token (in production, use JWT or signed token)
    const confirmToken = Buffer.from(
      JSON.stringify({ fromStoreId, toStoreId, customerIds, timestamp: Date.now() }),
    ).toString('base64');

    return {
      confirmToken,
      summary: { count, fromStoreId, toStoreId },
    };
  }

  async migrate(fromStoreId: number, toStoreId: number, customerIds: number[]): Promise<{ migrated: number }> {
    const result = await this.customerRepo.update({ store_id: fromStoreId, id: In(customerIds) }, {
      store_id: toStoreId,
    } as Partial<Customer>);

    return { migrated: result.affected ?? 0 };
  }
}
