import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CaseService } from './case.service';
import { Case } from './entities/case.entity';
import { CaseLike } from './entities/case-like.entity';
import { Configuration } from '../configuration/entities/configuration.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { StoreContext } from '../../common/context/store-context';

jest.mock('../../common/context/store-context');

describe('CaseService', () => {
  let service: CaseService;
  let caseRepo: jest.Mocked<
    Pick<Repository<Case>, 'findOne' | 'findAndCount' | 'create' | 'save' | 'update' | 'increment'>
  >;
  let configRepo: jest.Mocked<Pick<Repository<Configuration>, 'findOne'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'createQueryRunner'>>;

  const createMockQueryRunner = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      insert: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    },
  });

  const mockConfig: Partial<Configuration> = {
    id: 10,
    store_id: 1,
    model_id: 1,
    status: 'confirmed' as const,
    staff_id: 1,
    name: 'test config',
    note: null,
    customer_name: null,
    customer_phone: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 10,
    title: 'Test Case',
    description: null,
    cover_image_url: null,
    images: null,
    status: 'published',
    view_count: 0,
    like_count: 0,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (StoreContext.getStoreId as jest.Mock).mockReturnValue(1);
    (StoreContext.getStaffId as jest.Mock).mockReturnValue(1);
    (StoreContext.isAdmin as jest.Mock).mockReturnValue(false);
    (StoreContext.getRole as jest.Mock).mockReturnValue('staff');

    const mockQueryRunner = createMockQueryRunner();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CaseLike),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            insert: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Configuration),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
    caseRepo = module.get(getRepositoryToken(Case));
    configRepo = module.get(getRepositoryToken(Configuration));
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create case from confirmed configuration', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      caseRepo.findOne.mockResolvedValue(null);
      caseRepo.create.mockReturnValue(mockCase as Case);
      caseRepo.save.mockResolvedValue(mockCase as Case);

      const result = await service.create({
        configuration_id: 10,
        title: 'Test Case',
      });

      expect(result).toBeDefined();
      expect(configRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 10 }) }),
      );
      expect(caseRepo.save).toHaveBeenCalled();
    });

    it('should throw when configuration does not exist', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(service.create({ configuration_id: 999, title: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should throw when configuration status is not confirmed', async () => {
      const draftConfig = { ...mockConfig, status: 'draft' as const };
      configRepo.findOne.mockResolvedValue(draftConfig as Configuration);

      await expect(service.create({ configuration_id: 10, title: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should throw when case already exists for configuration', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig as Configuration);
      caseRepo.findOne.mockResolvedValue(mockCase as Case);

      await expect(service.create({ configuration_id: 10, title: 'Test' })).rejects.toThrow(BusinessException);
    });
  });

  describe('findAll', () => {
    it('should return paginated cases without store_id filter', async () => {
      const cases = [mockCase, { ...mockCase, id: 2 }];
      caseRepo.findAndCount.mockResolvedValue([cases as Case[], 2]);

      const result = await service.findAll({
        page: 1,
        size: 20,
        status: 'published',
        sort: 'created_at',
      } as unknown as Parameters<CaseService['findAll']>[0]);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(caseRepo.findAndCount).toHaveBeenCalled();
      // Verify no store_id filter is applied (public endpoint)
      const findArgs = caseRepo.findAndCount.mock.calls[0][0];
      expect(findArgs?.where).not.toHaveProperty('store_id');
    });

    it('should return empty list when no cases exist', async () => {
      caseRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({
        page: 1,
        size: 20,
        status: 'published',
        sort: 'created_at',
      } as unknown as Parameters<CaseService['findAll']>[0]);

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return case with relations and increment view_count', async () => {
      const caseWithRelations = { ...mockCase, view_count: 5 };
      caseRepo.findOne.mockResolvedValue(caseWithRelations as Case);
      caseRepo.increment.mockResolvedValue({} as unknown as ReturnType<Repository<Case>['increment']>);

      const result = await service.findById(1);

      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(caseRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deleted_at: expect.anything() },
          relations: expect.arrayContaining(['configuration']),
        }),
      );
      expect(caseRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'view_count', 1);
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should update case fields', async () => {
      caseRepo.findOne.mockResolvedValueOnce(mockCase as Case); // first call in update()
      caseRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Case>['update']>);
      caseRepo.findOne.mockResolvedValueOnce({ ...mockCase, title: 'Updated Title' } as Case); // second call after update (findById)

      const result = await service.update(1, { title: 'Updated Title' });

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Title');
      expect(caseRepo.update).toHaveBeenCalled();
    });

    it('should throw when case not found for store', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { title: 'Test' })).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should soft delete case', async () => {
      caseRepo.findOne.mockResolvedValue(mockCase as Case);
      caseRepo.update.mockResolvedValue({ affected: 1 } as unknown as ReturnType<Repository<Case>['update']>);

      await service.delete(1);

      expect(caseRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ deleted_at: expect.any(Date) }));
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('like', () => {
    it('should add like and increment like_count', async () => {
      caseRepo.findOne.mockResolvedValueOnce({ ...mockCase, store_id: 1 } as Case); // validate case exists
      const mockQueryRunner = dataSource.createQueryRunner();

      const result = await service.like(1);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.insert).toHaveBeenCalledWith(CaseLike, expect.objectContaining({ case_id: 1 }));
      expect(mockQueryRunner.manager.increment).toHaveBeenCalledWith(Case, { id: 1 }, 'like_count', 1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.is_liked).toBe(true);
    });

    it('should be idempotent when duplicate like', async () => {
      caseRepo.findOne.mockResolvedValueOnce({ ...mockCase, store_id: 1 } as Case); // validate case exists

      const mockQueryRunner = dataSource.createQueryRunner();
      const dupError: NodeJS.ErrnoException = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      (mockQueryRunner.manager.insert as jest.Mock).mockRejectedValueOnce(dupError);

      // After duplicate is caught and committed, findOne returns updated case
      caseRepo.findOne.mockResolvedValueOnce({ ...mockCase, like_count: 1 } as Case);

      const result = await service.like(1);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.is_liked).toBe(true);
    });

    it('should throw when case not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(service.like(999)).rejects.toThrow(BusinessException);
    });
  });
});
