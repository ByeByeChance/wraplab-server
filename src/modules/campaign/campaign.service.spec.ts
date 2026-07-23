import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignService } from './campaign.service';
import { Campaign } from './entities/campaign.entity';
import { CampaignClaim } from './entities/campaign-claim.entity';
import { Quote } from '../quote/entities/quote.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('CampaignService', () => {
  let service: CampaignService;

  const mockCampaignRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockClaimRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const mockQuoteRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const mockCustomerRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: getRepositoryToken(Campaign), useValue: mockCampaignRepo },
        { provide: getRepositoryToken(CampaignClaim), useValue: mockClaimRepo },
        { provide: getRepositoryToken(Quote), useValue: mockQuoteRepo },
        { provide: getRepositoryToken(Customer), useValue: mockCustomerRepo },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  describe('create', () => {
    it('should create a campaign', async () => {
      const dto = {
        name: 'Sale',
        type: 'PERCENTAGE',
        discount_value: 10,
        start_time: '2026-01-01',
        end_time: '2026-12-31',
      } as CreateCampaignDto;
      mockCampaignRepo.create.mockReturnValue(dto);
      const saved = { ...dto, id: 1 } as unknown as Campaign;
      mockCampaignRepo.create.mockReturnValue(dto);
      mockCampaignRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated campaigns', async () => {
      mockCampaignRepo.findAndCount.mockResolvedValue([[{ id: 1, name: 'C1' } as Campaign], 1]);

      const result = await service.findAll({ page: 1, size: 20, skip: 0, take: 20 });

      expect(result.list).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return campaign by id', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({ id: 1, name: 'C1' } as Campaign);
      const result = await service.findById(1);
      expect(result.name).toBe('C1');
    });

    it('should throw when not found', async () => {
      mockCampaignRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow('Campaign not found');
    });
  });

  describe('update', () => {
    it('should update a campaign', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({ id: 1 } as Campaign);
      mockCampaignRepo.update.mockResolvedValue({ affected: 1 });

      await service.update(1, { name: 'Updated' } as UpdateCampaignDto);
      expect(mockCampaignRepo.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a campaign', async () => {
      mockCampaignRepo.findOne.mockResolvedValue({ id: 1 } as Campaign);
      mockCampaignRepo.update.mockResolvedValue({ affected: 1 });

      await service.delete(1);
      expect(mockCampaignRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ deleted_at: expect.any(Date) }),
      );
    });
  });

  describe('findAvailable', () => {
    it('should return active campaigns within date range', async () => {
      mockCampaignRepo.find.mockResolvedValue([{ id: 1, name: 'Active', status: 'active' } as Campaign]);

      const result = await service.findAvailable();

      expect(result).toHaveLength(1);
    });
  });

  describe('applyCampaign', () => {
    const quote = {
      id: 1,
      store_id: 1,
      total_price: 5000,
      configuration: { customer_phone: undefined },
    } as unknown as Quote;
    const campaign = {
      id: 1,
      name: '10% Off',
      type: 'PERCENTAGE' as const,
      discount_value: 10,
      min_amount: null,
      target_store_ids: null,
      new_customer_only: false,
      status: 'active' as const,
      approval_status: 'approved' as const,
      start_time: new Date('2026-01-01'),
      end_time: new Date('2026-12-31'),
    };

    it('should apply percentage discount', async () => {
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(campaign);
      mockClaimRepo.findOne.mockResolvedValue(null);

      mockClaimRepo.manager.transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({ id: 1, campaign_id: 1, quote_id: 1, store_id: 1, discount_amount: 500 }),
          save: jest.fn().mockResolvedValue({ id: 1 }),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return fn(mockManager);
      });

      const result = await service.applyCampaign(1, 1);

      expect(result.discount_amount).toBe(500); // 5000 * 10%
      expect(result.final_price).toBe(4500);
    });

    it('should apply fixed amount discount', async () => {
      const fixedCampaign = {
        ...campaign,
        type: 'FIXED_AMOUNT' as const,
        discount_value: 300,
      };

      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(fixedCampaign);
      mockClaimRepo.findOne.mockResolvedValue(null);

      mockClaimRepo.manager.transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({ discount_amount: 300 }),
          save: jest.fn().mockResolvedValue({ id: 1 }),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return fn(mockManager);
      });

      const result = await service.applyCampaign(1, 1);

      expect(result.discount_amount).toBe(300);
      expect(result.final_price).toBe(4700);
    });

    it('should throw when campaign not found', async () => {
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(null);

      await expect(service.applyCampaign(1, 999)).rejects.toThrow('Campaign not found');
    });

    it('should throw when campaign is expired', async () => {
      const expiredCampaign = {
        ...campaign,
        end_time: new Date('2025-12-31'),
      };
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(expiredCampaign);

      await expect(service.applyCampaign(1, 1)).rejects.toThrow('not in valid date range');
    });

    it('should throw when min_amount not met', async () => {
      const minCampaign = { ...campaign, min_amount: 10000 };
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(minCampaign);

      await expect(service.applyCampaign(1, 1)).rejects.toThrow('Minimum order amount');
    });

    it('should throw when store not included', async () => {
      const restrictedCampaign = { ...campaign, target_store_ids: [2, 3] };
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(restrictedCampaign);

      await expect(service.applyCampaign(1, 1)).rejects.toThrow('not eligible');
    });

    it('should throw when already claimed', async () => {
      mockQuoteRepo.findOne.mockResolvedValue(quote);
      mockCampaignRepo.findOne.mockResolvedValue(campaign);
      mockClaimRepo.findOne.mockResolvedValue({ id: 1 });

      await expect(service.applyCampaign(1, 1)).rejects.toThrow('Campaign already claimed');
    });
  });

  describe('approval', () => {
    const makeDraftCampaign = (): Campaign =>
      ({
        id: 1,
        name: 'Draft Campaign',
        status: 'draft',
        approval_status: 'pending',
      }) as Campaign;

    const makePendingCampaign = (): Campaign =>
      ({
        ...makeDraftCampaign(),
        status: 'pending_approval',
        start_time: new Date('2027-01-01'),
      }) as Campaign;

    beforeEach(() => {
      (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
      (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    });

    it('should submit draft for approval', async () => {
      const draft = makeDraftCampaign();
      mockCampaignRepo.findOne.mockResolvedValue(draft);
      mockCampaignRepo.save.mockResolvedValue({
        ...makeDraftCampaign(),
        status: 'pending_approval',
      } as Campaign);

      const result = await service.submitForApproval(1);

      expect(result.status).toBe('pending_approval');
    });

    it('should approve pending campaign (future start, status -> approved)', async () => {
      const pending = makePendingCampaign();
      mockCampaignRepo.findOne.mockResolvedValue(pending);
      mockCampaignRepo.save.mockResolvedValue({
        ...makePendingCampaign(),
        status: 'approved',
        approval_status: 'approved',
      } as Campaign);

      const result = await service.approve(1);

      expect(result.status).toBe('approved');
      expect(result.approval_status).toBe('approved');
    });

    it('should reject pending campaign', async () => {
      const pending = makePendingCampaign();
      mockCampaignRepo.findOne.mockResolvedValue(pending);
      mockCampaignRepo.save.mockResolvedValue({
        ...makePendingCampaign(),
        approval_status: 'rejected',
        reject_reason: 'Not valid',
      } as Campaign);

      const result = await service.reject(1, 'Not valid');

      expect(result.approval_status).toBe('rejected');
      expect(result.reject_reason).toBe('Not valid');
    });

    it('should throw when approving non-pending campaign', async () => {
      mockCampaignRepo.findOne.mockResolvedValue(makeDraftCampaign());

      await expect(service.approve(1)).rejects.toThrow();
    });

    it('should throw when submitting non-draft campaign', async () => {
      mockCampaignRepo.findOne.mockResolvedValue(makePendingCampaign());

      await expect(service.submitForApproval(1)).rejects.toThrow();
    });
  });

  describe('findApprovals', () => {
    it('should return pending approvals', async () => {
      mockCampaignRepo.findAndCount.mockResolvedValue([[{ id: 1, status: 'pending_approval' } as Campaign], 1]);

      const result = await service.findApprovals({ page: 1, size: 20, skip: 0, take: 20 });

      expect(result.list).toHaveLength(1);
    });
  });
});
