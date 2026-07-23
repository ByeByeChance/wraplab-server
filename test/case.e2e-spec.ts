import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Case } from '../src/modules/case/entities/case.entity';
import { CaseLike } from '../src/modules/case/entities/case-like.entity';
import { CaseTag } from '../src/modules/case/entities/case-tag.entity';
import { CaseTagRelation } from '../src/modules/case/entities/case-tag-relation.entity';
import { Configuration } from '../src/modules/configuration/entities/configuration.entity';
import { Comment } from '../src/modules/comment/entities/comment.entity';
import { CommentVote } from '../src/modules/comment/entities/comment-vote.entity';
import { JwtService } from '@nestjs/jwt';

/**
 * Reusable createQueryBuilder mock that returns chained methods.
 */
const mockQueryBuilder = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue(null),
  getRawMany: jest.fn().mockResolvedValue([]),
  setParameters: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  clone: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('Case (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let caseRepo: Repository<Case>;
  let commentRepo: Repository<Comment>;
  let commentVoteRepo: Repository<CommentVote>;
  let jwtService: JwtService;
  let validToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Staff))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Store))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Case))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        findAndCount: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        increment: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CaseLike))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CaseTag))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CaseTagRelation))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Configuration))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Comment))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        increment: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CommentVote))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    caseRepo = moduleFixture.get(getRepositoryToken(Case));
    commentRepo = moduleFixture.get(getRepositoryToken(Comment));
    commentVoteRepo = moduleFixture.get(getRepositoryToken(CommentVote));
    jwtService = moduleFixture.get(JwtService);

    validToken = jwtService.sign(
      {
        sub: 1,
        store_id: 1,
        role: 'staff',
        phone: '13800138000',
        token_version: 0,
        jti: 'case-jti',
      },
      { secret: process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-e2e' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const mockStaffAuth = () => {
    (staffRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
      store_id: 1,
      token_version: 0,
    });
    (storeRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
    });
  };

  describe('GET /api/v1/cases (public)', () => {
    it('should return paginated cases list', async () => {
      (caseRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/api/v1/cases')
        .expect(200);
    });

    it('should accept pagination query params', async () => {
      (caseRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/api/v1/cases?page=1&size=20')
        .expect(200);
    });
  });

  describe('GET /api/v1/cases/:id (public)', () => {
    it('should return 400 when id is not a number', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/cases/abc')
        .expect(400);
    });
  });

  describe('GET /api/v1/cases/:id/recommendations (public)', () => {
    it('should return 400 when id is not a number', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/cases/abc/recommendations')
        .expect(400);
    });
  });

  describe('POST /api/v1/cases', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases')
        .send({})
        .expect(401);
    });
  });

  describe('POST /api/v1/cases/comments/:id/vote', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cases/comments/1/vote')
        .expect(401);
    });

    it('should return 400 when id is not a number', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .post('/api/v1/cases/comments/abc/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });

    it('should toggle vote when authenticated', async () => {
      mockStaffAuth();
      (commentVoteRepo.findOne as jest.Mock).mockResolvedValue(null);
      (commentVoteRepo.create as jest.Mock).mockReturnValue({
        comment_id: 1,
        staff_id: 1,
        store_id: 1,
      });
      (commentVoteRepo.save as jest.Mock).mockResolvedValue({ id: 1 });
      (commentRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        vote_count: 0,
      });
      (commentRepo.increment as jest.Mock).mockResolvedValue({ affected: 1 });

      await request(app.getHttpServer())
        .post('/api/v1/cases/comments/1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(201);
    });
  });
});
