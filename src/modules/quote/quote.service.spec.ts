import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuoteService } from './quote.service';
import { Quote } from './entities/quote.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { PartColor } from '../configuration/entities/part-color.entity';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('QuoteService', () => {
  let service: QuoteService;

  const mockQuoteRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const mockConfigRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const mockPartColorRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(5);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: getRepositoryToken(Quote), useValue: mockQuoteRepo },
        { provide: getRepositoryToken(Configuration), useValue: mockConfigRepo },
        { provide: getRepositoryToken(PartColor), useValue: mockPartColorRepo },
      ],
    }).compile();

    service = module.get<QuoteService>(QuoteService);
  });

  describe('create', () => {
    it('should calculate total price correctly (15 * 300 * 1.0 = 4500)', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        id: 99,
        store_id: 1,
        status: 'draft',
      } as Configuration);

      mockPartColorRepo.find.mockResolvedValue([
        {
          part_code: 'FULL',
          colorSwatch: { price_per_m2: 300.0 },
          material: { price_multiplier: 1.0 },
        } as PartColor,
      ]);

      const savedQuote = {
        id: 10,
        store_id: 1,
        configuration_id: 99,
        total_price: 4500.0,
        status: 'pending',
        staff_id: 5,
      };
      mockQuoteRepo.create.mockReturnValue(savedQuote);
      mockQuoteRepo.save.mockResolvedValue(savedQuote);
      mockQuoteRepo.findOne.mockResolvedValue({
        ...savedQuote,
        configuration: { id: 99 } as Configuration,
      });

      const result = await service.create({ configuration_id: 99 });

      expect(result).toBeDefined();
      expect(mockQuoteRepo.save).toHaveBeenCalled();
      expect(mockConfigRepo.update).toHaveBeenCalledWith(99, { status: 'quoted' });
    });

    it('should throw when configuration not found', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ configuration_id: 999 })).rejects.toThrow('改色方案不存在');
    });

    it('should throw when configuration already quoted', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        id: 99,
        store_id: 1,
        status: 'quoted',
      } as Configuration);

      await expect(service.create({ configuration_id: 99 })).rejects.toThrow('该方案已生成报价单');
    });
  });
});
