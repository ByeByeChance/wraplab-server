import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignClaim } from './entities/campaign-claim.entity';
import { Quote } from '../quote/entities/quote.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignClaim)
    private readonly claimRepo: Repository<CampaignClaim>,
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  // Admin CRUD

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const campaign = this.campaignRepo.create(dto);
    return this.campaignRepo.save(campaign);
  }

  async findAll(pagination: PaginationDto): Promise<{ list: Campaign[]; total: number; page: number; size: number }> {
    const [list, total] = await this.campaignRepo.findAndCount({
      where: { deleted_at: IsNull() },
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async findById(id: number): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) {
      throw new BusinessException(ErrorCode.CAMPAIGN_NOT_FOUND, 'Campaign not found');
    }
    return campaign;
  }

  async update(id: number, dto: UpdateCampaignDto): Promise<Campaign> {
    await this.findById(id); // validate exists
    await this.campaignRepo.update(id, dto);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.findById(id); // validate exists
    // Soft delete: mark deleted_at instead of hard delete, consistent with other modules
    await this.campaignRepo.update(id, { deleted_at: new Date() } as Partial<Campaign>);
  }

  // Public

  async findAvailable(): Promise<Campaign[]> {
    const now = new Date();
    return this.campaignRepo.find({
      where: {
        status: 'active',
        start_time: LessThanOrEqual(now),
        end_time: MoreThanOrEqual(now),
      },
      order: { created_at: 'DESC' },
    });
  }

  // --- Approval ---

  async findMyCampaigns(
    pagination: PaginationDto,
    approvalStatus?: string,
  ): Promise<{ list: Campaign[]; total: number; page: number; size: number }> {
    const where: Record<string, unknown> = {};
    if (approvalStatus) {
      where.approval_status = approvalStatus;
    }

    const [list, total] = await this.campaignRepo.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async submitForApproval(id: number): Promise<Campaign> {
    const campaign = await this.findById(id);

    if (campaign.status !== 'draft') {
      throw new BusinessException(
        ErrorCode.CAMPAIGN_APPROVAL_REQUIRED,
        'Only draft campaigns can be submitted for approval',
      );
    }

    campaign.status = 'pending_approval';
    campaign.approval_status = 'pending';
    return this.campaignRepo.save(campaign);
  }

  async findApprovals(
    pagination: PaginationDto,
    status?: string,
  ): Promise<{ list: Campaign[]; total: number; page: number; size: number }> {
    const where: Record<string, unknown> = {
      status: 'pending_approval',
    };
    if (status) {
      where.approval_status = status;
    }

    const [list, total] = await this.campaignRepo.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { created_at: 'DESC' },
    });

    return { list, total, page: pagination.page, size: pagination.size };
  }

  async approve(id: number): Promise<Campaign> {
    const staffId = StoreContext.getStaffId();
    const campaign = await this.findById(id);

    if (campaign.status !== 'pending_approval') {
      throw new BusinessException(
        ErrorCode.CAMPAIGN_APPROVAL_REQUIRED,
        'Can only approve campaigns in pending_approval status',
      );
    }

    // State machine: pending_approval → approved (if valid_from > NOW) or → active (if valid_from <= NOW)
    const now = new Date();
    campaign.status = campaign.start_time > now ? 'approved' : 'active';
    campaign.approval_status = 'approved';
    campaign.approved_by = staffId;
    campaign.approved_at = now;
    campaign.reject_reason = null;

    return this.campaignRepo.save(campaign);
  }

  async reject(id: number, reason: string): Promise<Campaign> {
    const campaign = await this.findById(id);

    if (campaign.status !== 'pending_approval') {
      throw new BusinessException(
        ErrorCode.CAMPAIGN_APPROVAL_REQUIRED,
        'Can only reject campaigns in pending_approval status',
      );
    }

    campaign.approval_status = 'rejected';
    campaign.reject_reason = reason;
    return this.campaignRepo.save(campaign);
  }

  // --- Scheduling ---

  async schedule(id: number, scheduledAt: Date): Promise<Campaign> {
    const campaign = await this.findById(id);

    if (campaign.status !== 'approved') {
      throw new BusinessException(ErrorCode.CAMPAIGN_APPROVAL_REQUIRED, 'Can only schedule approved campaigns');
    }

    campaign.start_time = scheduledAt;
    return this.campaignRepo.save(campaign);
  }

  async applyCampaign(quoteId: number, campaignId: number): Promise<{ discount_amount: number; final_price: number }> {
    const storeId = StoreContext.getStoreId() as number;

    // Find quote
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, store_id: storeId } });
    if (!quote) {
      throw new BusinessException(ErrorCode.QUOTE_NOT_FOUND, 'Quote not found');
    }

    // Find campaign
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new BusinessException(ErrorCode.CAMPAIGN_NOT_FOUND, 'Campaign not found');
    }

    // Check campaign is active and approved
    if (campaign.status !== 'active') {
      throw new BusinessException(ErrorCode.CAMPAIGN_EXPIRED, 'Campaign is not active');
    }

    if (campaign.approval_status !== 'approved') {
      throw new BusinessException(ErrorCode.CAMPAIGN_APPROVAL_REQUIRED, 'Campaign has not been approved');
    }

    // Check date validity
    const now = new Date();
    if (now < campaign.start_time || now > campaign.end_time) {
      throw new BusinessException(ErrorCode.CAMPAIGN_EXPIRED, 'Campaign is not in valid date range');
    }

    // Check min_amount
    if (campaign.min_amount !== null && Number(quote.total_price) < Number(campaign.min_amount)) {
      throw new BusinessException(
        ErrorCode.CAMPAIGN_MIN_AMOUNT_NOT_MET,
        `Minimum order amount ${campaign.min_amount} not met`,
      );
    }

    // Check store membership
    if (
      campaign.target_store_ids !== null &&
      campaign.target_store_ids.length > 0 &&
      !campaign.target_store_ids.includes(storeId)
    ) {
      throw new BusinessException(
        ErrorCode.CAMPAIGN_STORE_NOT_INCLUDED,
        'This store is not eligible for this campaign',
      );
    }

    // Check new_customer_only
    if (campaign.new_customer_only) {
      // Check if customer has prior orders (via customer table)
      // Extract customer phone from quote's configuration
      const quoteWithConfig = await this.quoteRepo.findOne({
        where: { id: quoteId },
        relations: ['configuration'],
      });

      if (quoteWithConfig?.configuration) {
        const phone = (quoteWithConfig.configuration as { customer_phone?: string }).customer_phone;
        if (phone) {
          const existingCustomer = await this.customerRepo.findOne({
            where: { store_id: storeId, phone },
          });
          if (existingCustomer && existingCustomer.total_orders > 0) {
            throw new BusinessException(
              ErrorCode.CAMPAIGN_NEW_CUSTOMER_ONLY,
              'This campaign is for new customers only',
            );
          }
        }
      }
    }

    // Check already claimed
    const existingClaim = await this.claimRepo.findOne({
      where: { quote_id: quoteId, campaign_id: campaignId },
    });
    if (existingClaim) {
      throw new BusinessException(ErrorCode.CAMPAIGN_ALREADY_CLAIMED, 'Campaign already claimed for this quote');
    }

    // Calculate discount
    let discountAmount = 0;
    const totalPrice = Number(quote.total_price);

    if (campaign.type === 'PERCENTAGE') {
      discountAmount = totalPrice * (Number(campaign.discount_value) / 100);
    } else if (campaign.type === 'FIXED_AMOUNT') {
      discountAmount = Math.min(Number(campaign.discount_value), totalPrice);
    }
    // GIFT type: no discount amount, but campaign is applied

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalPrice = Math.round((totalPrice - discountAmount) * 100) / 100;

    // Save claim and update quote atomically in a transaction
    await this.claimRepo.manager.transaction(async (manager) => {
      // Re-check claim within transaction to prevent double-claims
      const existingInTx = await manager.findOne(CampaignClaim, {
        where: { quote_id: quoteId, campaign_id: campaignId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingInTx) {
        throw new BusinessException(ErrorCode.CAMPAIGN_ALREADY_CLAIMED, 'Campaign already claimed for this quote');
      }

      const claim = manager.create(CampaignClaim, {
        campaign_id: campaignId,
        quote_id: quoteId,
        store_id: storeId,
        discount_amount: discountAmount,
      });
      await manager.save(claim);

      await manager.update(Quote, quoteId, {
        campaign_id: campaignId,
        discount_amount: discountAmount,
        final_price: finalPrice,
      });
    });

    return { discount_amount: discountAmount, final_price: finalPrice };
  }
}
