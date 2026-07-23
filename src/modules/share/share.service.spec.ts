import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShareService } from './share.service';
import { Case } from '../case/entities/case.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('ShareService', () => {
  let service: ShareService;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'findOne' | 'increment'>>;
  let storeRepo: jest.Mocked<Pick<Repository<Store>, 'findOne'>>;

  const mockStore: Partial<Store> = {
    id: 1,
    name: '驰享车衣·朝阳店',
    logo: 'https://oss.wraplab.com/logo.png',
    status: 'active',
  };

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 10,
    title: '宝马 3系 / AX 哑光灰',
    cover_image_url: 'https://oss.wraplab.com/cases/1/cover.jpg',
    status: 'published',
    view_count: 100,
    like_count: 50,
    share_count: 5,
    comment_count: 3,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    configuration: {
      id: 10,
      model: {
        id: 1,
        name: '320i',
        series: {
          id: 1,
          name: '3系',
          brand: {
            id: 1,
            name: '宝马',
          },
        },
      },
    } as Case['configuration'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareService,
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findOne: jest.fn(),
            increment: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ShareService>(ShareService);
    caseRepo = module.get(getRepositoryToken(Case));
    storeRepo = module.get(getRepositoryToken(Store));
  });

  describe('getShareCardData', () => {
    it('should return share card data with store info', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      storeRepo.findOne.mockResolvedValue(mockStore as Store);

      const result = await service.getShareCardData(1);

      expect(result.case_id).toBe(1);
      expect(result.title).toBe('宝马 3系 / AX 哑光灰');
      expect(result.cover_image_url).toBe('https://oss.wraplab.com/cases/1/cover.jpg');
      expect(result.store_name).toBe('驰享车衣·朝阳店');
      expect(result.store_logo).toBe('https://oss.wraplab.com/logo.png');
      expect(result.summary).toContain('宝马');
      expect(result.summary).toContain('320i');
      expect(result.wxa_code_url).toContain('wxacode');
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.getShareCardData(999)).rejects.toThrow(BusinessException);
    });

    it('should return default store name when store not found', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      storeRepo.findOne.mockResolvedValue(null);

      const result = await service.getShareCardData(1);

      expect(result.store_name).toBe('WrapLab');
      expect(result.store_logo).toBeNull();
    });
  });

  describe('recordShare', () => {
    it('should increment share_count and return updated count', async () => {
      caseRepo.findOne
        .mockResolvedValueOnce(mockCase as Case) // validate exists
        .mockResolvedValueOnce({ id: 1, share_count: 6 } as Case); // re-fetch after increment
      caseRepo.increment.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['increment']>);

      const result = await service.recordShare(1, { platform: 'wechat_friend' });

      expect(result.share_count).toBe(6);
      expect(caseRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'share_count', 1);
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.recordShare(999, { platform: 'wechat_friend' })).rejects.toThrow(BusinessException);
    });
  });
});
