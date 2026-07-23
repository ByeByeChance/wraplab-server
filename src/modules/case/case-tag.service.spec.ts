import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CaseTagService } from './case-tag.service';
import { CaseTag } from './entities/case-tag.entity';
import { CaseTagRelation } from './entities/case-tag-relation.entity';
import { Case } from './entities/case.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';

describe('CaseTagService', () => {
  let service: CaseTagService;
  let tagRepo: jest.Mocked<Pick<Repository<CaseTag>, 'find' | 'findOne' | 'create' | 'save' | 'update' | 'findOneByOrFail' | 'createQueryBuilder'>>;
  let relationRepo: jest.Mocked<Pick<Repository<CaseTagRelation>, 'find' | 'delete' | 'manager'>>;
  let caseRepo: jest.Mocked<Pick<Repository<Case>, 'findOne'>>;

  const mockTag: Partial<CaseTag> = {
    id: 1,
    name: '热门',
    color: '#FF0000',
    sort_order: 1,
    store_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockCase: Partial<Case> = {
    id: 1,
    store_id: 1,
    configuration_id: 1,
    title: 'Test Case',
    status: 'published',
    view_count: 0,
    like_count: 0,
    share_count: 0,
    comment_count: 0,
    staff_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const mockManager = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseTagService,
        {
          provide: getRepositoryToken(CaseTag),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            findOneByOrFail: jest.fn(),
            createQueryBuilder: jest.fn(),
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(CaseTagRelation),
          useValue: {
            find: jest.fn(),
            delete: jest.fn(),
            manager: mockManager,
          },
        },
        {
          provide: getRepositoryToken(Case),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CaseTagService>(CaseTagService);
    tagRepo = module.get(getRepositoryToken(CaseTag));
    relationRepo = module.get(getRepositoryToken(CaseTagRelation));
    caseRepo = module.get(getRepositoryToken(Case));
  });

  describe('getPublicTags', () => {
    it('should return store-specific and global tags when storeId provided', async () => {
      const tags = [mockTag, { ...mockTag, id: 2, name: '新品', store_id: null }];
      (tagRepo.find as jest.Mock).mockResolvedValue(tags as CaseTag[]);

      const result = await service.getPublicTags(1);

      expect(result).toHaveLength(2);
      expect(tagRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Array), order: expect.any(Object) }),
      );
    });

    it('should return all non-deleted tags when storeId is undefined', async () => {
      (tagRepo.find as jest.Mock).mockResolvedValue([mockTag] as CaseTag[]);

      const result = await service.getPublicTags();

      expect(result).toHaveLength(1);
      expect(tagRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object), order: expect.any(Object) }),
      );
    });

    it('should return empty array when no tags exist', async () => {
      (tagRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getPublicTags();

      expect(result).toHaveLength(0);
    });
  });

  describe('getAdminTags', () => {
    it('should query tags with storeId and keyword filter', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTag] as CaseTag[]),
      };
      (tagRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getAdminTags(1, '热');

      expect(result).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should query tags without filters', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTag] as CaseTag[]),
      };
      (tagRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getAdminTags();

      expect(result).toHaveLength(1);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a tag', async () => {
      (tagRepo.findOne as jest.Mock).mockResolvedValue(null);
      (tagRepo.create as jest.Mock).mockReturnValue(mockTag as CaseTag);
      (tagRepo.save as jest.Mock).mockResolvedValue(mockTag as CaseTag);

      const result = await service.create({ name: '热门', store_id: 1 });

      expect(result).toBeDefined();
      expect(result.name).toBe('热门');
      expect(tagRepo.save).toHaveBeenCalled();
    });

    it('should throw when tag name already exists', async () => {
      (tagRepo.findOne as jest.Mock).mockResolvedValue(mockTag as CaseTag);

      await expect(service.create({ name: '热门', store_id: 1 })).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should update tag fields', async () => {
      (tagRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockTag as CaseTag) // findBy id
        .mockResolvedValueOnce(null); // duplicate name check
      (tagRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (tagRepo.findOneByOrFail as jest.Mock).mockResolvedValue({ ...mockTag, name: 'NewName' } as CaseTag);

      const result = await service.update(1, { name: 'NewName' });

      expect(result.name).toBe('NewName');
      expect(tagRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'NewName' }));
    });

    it('should throw when tag not found', async () => {
      (tagRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(BusinessException);
    });

    it('should throw when new name conflicts with existing', async () => {
      const otherTag = { ...mockTag, id: 2, name: 'Existing' };
      (tagRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(mockTag as CaseTag) // findBy id
        .mockResolvedValueOnce(otherTag as CaseTag); // duplicate check

      await expect(service.update(1, { name: 'Existing' })).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should soft-delete tag and relations', async () => {
      (tagRepo.findOne as jest.Mock).mockResolvedValue(mockTag as CaseTag);

      const mockTransaction = jest.fn(async (cb: (manager: Record<string, jest.Mock>) => Promise<void>) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue(undefined),
          delete: jest.fn().mockResolvedValue(undefined),
        };
        await cb(mockManager);
      });
      (tagRepo as unknown as { manager: { transaction: jest.Mock } }).manager.transaction = mockTransaction;

      await service.delete(1);

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw when tag not found', async () => {
      (tagRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(BusinessException);
    });
  });

  describe('setCaseTags', () => {
    it('should set tags on a case', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (tagRepo.find as jest.Mock).mockResolvedValue([mockTag] as CaseTag[]);

      const mockTransaction = jest.fn(async (cb: (manager: Record<string, jest.Mock>) => Promise<void>) => {
        const mockManager = {
          delete: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockReturnValue({ case_id: 1, tag_id: 1 }),
          save: jest.fn().mockResolvedValue([{ case_id: 1, tag_id: 1 }]),
        };
        await cb(mockManager);
      });
      (tagRepo as unknown as { manager: { transaction: jest.Mock } }).manager.transaction = mockTransaction;

      await service.setCaseTags(1, { tag_ids: [1] });

      expect(mockTransaction).toHaveBeenCalled();
      expect(tagRepo.find).toHaveBeenCalled();
    });

    it('should throw when case not found', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.setCaseTags(999, { tag_ids: [1] })).rejects.toThrow(BusinessException);
    });

    it('should throw when some tags do not exist', async () => {
      (caseRepo.findOne as jest.Mock).mockResolvedValue(mockCase as Case);
      (tagRepo.find as jest.Mock).mockResolvedValue([mockTag] as CaseTag[]);

      await expect(service.setCaseTags(1, { tag_ids: [1, 999] })).rejects.toThrow(BusinessException);
    });
  });

  describe('getTagsForCase', () => {
    it('should return tags for a case', async () => {
      const relations = [{ case_id: 1, tag_id: 1, id: 1, created_at: new Date() }];
      (relationRepo.find as jest.Mock).mockResolvedValue(relations as CaseTagRelation[]);
      (tagRepo.find as jest.Mock).mockResolvedValue([mockTag] as CaseTag[]);

      const result = await service.getTagsForCase(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('热门');
    });

    it('should return empty array when no relations', async () => {
      (relationRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getTagsForCase(1);

      expect(result).toHaveLength(0);
    });
  });
});
