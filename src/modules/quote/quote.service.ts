import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { PartColor } from '../configuration/entities/part-color.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { DEFAULT_FULL_CAR_AREA_M2 } from '../../common/constants/pricing.constant';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class QuoteService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Configuration)
    private readonly configRepo: Repository<Configuration>,
    @InjectRepository(PartColor)
    private readonly partColorRepo: Repository<PartColor>,
  ) {}

  async create(dto: { configuration_id: number }): Promise<Quote> {
    const storeId = StoreContext.getStoreId() as number;
    const staffId = StoreContext.getStaffId();

    // Find configuration (belonging to current store)
    const configWhere: FindOptionsWhere<Configuration> = {
      id: dto.configuration_id,
      store_id: storeId,
      deleted_at: IsNull(),
    };
    const config = await this.configRepo.findOne({
      where: configWhere,
      relations: ['model'],
    });

    if (!config) {
      throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND, '改色方案不存在');
    }

    if (config.status === 'quoted') {
      throw new BusinessException(ErrorCode.CONFIGURATION_ALREADY_QUOTED, '该方案已生成报价单');
    }

    // Get part_colors
    const partColors = await this.partColorRepo.find({
      where: { configuration_id: config.id, deleted_at: IsNull() },
      relations: ['colorSwatch', 'material'],
    });

    // Calculate total price
    let totalPrice = 0;
    const priceDetails: Array<{
      part_code: string;
      part_area: number;
      color_price_per_m2: number;
      material_multiplier: number;
      subtotal: number;
    }> = [];

    for (const pc of partColors) {
      const area = DEFAULT_FULL_CAR_AREA_M2;
      const colorPrice = Number(pc.colorSwatch?.price_per_m2 ?? 0);
      const materialMultiplier = Number(pc.material?.price_multiplier ?? 1);
      const subtotal = area * colorPrice * materialMultiplier;

      totalPrice += subtotal;
      priceDetails.push({
        part_code: pc.part_code,
        part_area: area,
        color_price_per_m2: colorPrice,
        material_multiplier: materialMultiplier,
        subtotal: Math.round(subtotal * 100) / 100,
      });
    }

    const quote = this.quoteRepo.create({
      store_id: storeId,
      configuration_id: config.id,
      total_price: Math.round(totalPrice * 100) / 100,
      status: 'pending',
      staff_id: staffId,
    });

    const savedQuote = await this.quoteRepo.save(quote);

    // Auto-update configuration status to 'quoted'
    await this.configRepo.update(config.id, { status: 'quoted' } as Partial<Configuration>);

    return (await this.findById(savedQuote.id))!;
  }

  async findAll(pagination: PaginationDto): Promise<{ list: Quote[]; total: number; page: number; size: number }> {
    const storeId = StoreContext.getStoreId() as number;
    const quoteWhere: FindOptionsWhere<Quote> = {
      store_id: storeId,
      deleted_at: IsNull(),
    };
    const [list, total] = await this.quoteRepo.findAndCount({
      where: quoteWhere,
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
      relations: ['configuration', 'configuration.model'],
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async findById(id: number): Promise<Quote | null> {
    const storeId = StoreContext.getStoreId();
    const isAdmin = StoreContext.isAdmin();

    const where: Record<string, unknown> = { id, deleted_at: IsNull() };
    if (!(isAdmin && storeId === null)) {
      where.store_id = storeId as number;
    }

    const quote = await this.quoteRepo.findOne({
      where,
      relations: [
        'configuration',
        'configuration.model',
        'configuration.model.series',
        'configuration.model.series.brand',
      ],
    });

    if (!quote) {
      throw new BusinessException(ErrorCode.QUOTE_NOT_FOUND, '报价单不存在');
    }

    // Also fetch part_colors for price details
    const partColors = await this.partColorRepo.find({
      where: { configuration_id: quote.configuration_id, deleted_at: IsNull() },
      relations: ['colorSwatch', 'material'],
    });

    // Attach price details to the response
    const quoteWithDetails = quote as Quote & { price_details: unknown[] };
    quoteWithDetails.price_details = partColors.map((pc) => {
      const area = DEFAULT_FULL_CAR_AREA_M2;
      const colorPrice = Number(pc.colorSwatch?.price_per_m2 ?? 0);
      const materialMultiplier = Number(pc.material?.price_multiplier ?? 1);
      return {
        part_code: pc.part_code,
        part_area: area,
        color_price_per_m2: colorPrice,
        material_multiplier: materialMultiplier,
        subtotal: Math.round(area * colorPrice * materialMultiplier * 100) / 100,
      };
    });

    return quoteWithDetails;
  }

  async delete(id: number): Promise<void> {
    const quote = await this.findById(id);
    if (!quote) {
      throw new BusinessException(ErrorCode.QUOTE_NOT_FOUND, '报价单不存在');
    }
    await this.quoteRepo.update(id, { deleted_at: new Date() } as Partial<Quote>);
  }
}
