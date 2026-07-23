import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { StaffStore } from '../src/modules/staff/entities/staff-store.entity';
import { JwtService } from '@nestjs/jwt';

describe('Store Admin (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let staffStoreRepo: Repository<StaffStore>;
  let jwtService: JwtService;
  let adminToken: string;

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
        count: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Store))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        findOneByOrFail: jest.fn(),
        findAndCount: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      })
      .overrideProvider(getRepositoryToken(StaffStore))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    staffStoreRepo = moduleFixture.get(getRepositoryToken(StaffStore));
    jwtService = moduleFixture.get(JwtService);

    // Generate an admin token
    adminToken = jwtService.sign(
      {
        sub: 1,
        store_id: null,
        role: 'admin',
        phone: '13800138000',
        token_version: 0,
        jti: 'admin-jti',
      },
      { secret: process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-e2e' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Helper to mock JWT strategy validation for admin user.
   */
  const mockAdminAuth = () => {
    (staffRepo.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'active',
      store_id: null,
      token_version: 0,
    });
  };

  describe('POST /api/v1/admin/stores', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .send({ name: 'Test Store', phone: '13800138000' })
        .expect(401);
    });

    it('should return 400 when required fields (name) are missing', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 400 for invalid phone format', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Store', phone: '12345' })
        .expect(400);
    });
  });

  describe('GET /api/v1/admin/stores', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .expect(401);
    });

    it('should return paginated list when authenticated as admin', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should accept pagination query params', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores?page=1&size=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('PUT /api/v1/admin/stores/:id', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/admin/stores/1')
        .send({ status: 'active' })
        .expect(401);
    });

    it('should return 400 for invalid status enum', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .put('/api/v1/admin/stores/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    it('should accept valid status value', async () => {
      mockAdminAuth();
      (storeRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Store A',
        status: 'active',
        deleted_at: null,
      });
      (storeRepo.findOneByOrFail as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Store A',
        status: 'active',
      });

      await request(app.getHttpServer())
        .put('/api/v1/admin/stores/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);
    });
  });

  describe('DELETE /api/v1/admin/stores/:id', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admin/stores/1')
        .expect(401);
    });
  });

  describe('GET /api/v1/admin/stores/:id/dashboard', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/1/dashboard?period=daily')
        .expect(401);
    });

    it('should return 400 when period is missing', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/1/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid period', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/1/dashboard?period=yearly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/admin/stores/comparison', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/comparison?store_ids=1,2,3&period=daily')
        .expect(401);
    });

    it('should return 400 when store_ids is missing', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/comparison?period=daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid store_ids format', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/stores/comparison?store_ids=abc&period=daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
