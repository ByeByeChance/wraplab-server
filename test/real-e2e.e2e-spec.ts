import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Quote } from '../src/modules/quote/entities/quote.entity';
import { createTestSchema, dropTestSchema } from './helpers/sqlite-schema';

describe('Real E2E - Full Business Flows (SQLite)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;

  let adminToken: string;
  let staffToken: string;
  let adminRefreshToken: string;
  let createdStoreId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await createTestSchema(dataSource);

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));

    // Seed a store first (needed for JWT validation)
    await storeRepo.save(
      storeRepo.create({
        name: 'Default Store',
        address: 'Test Address',
        phone: '13800000000',
        status: 'active',
        region: 'north',
      }),
    );

    // Seed admin (store_id=1 references the seeded store, but admin role may have null store_id)
    const adminHash = await bcrypt.hash('admin123', 4);
    await staffRepo.save(
      staffRepo.create({
        store_id: 1,
        current_store_id: 1,
        name: 'Admin',
        phone: '13800000001',
        password_hash: adminHash,
        role: 'admin',
        status: 'active',
        token_version: 0,
      }),
    );

    // Seed staff
    const staffHash = await bcrypt.hash('staff123', 4);
    await staffRepo.save(
      staffRepo.create({
        store_id: 1,
        current_store_id: 1,
        name: 'Staff User',
        phone: '13800000002',
        password_hash: staffHash,
        role: 'staff',
        status: 'active',
        token_version: 0,
      }),
    );
  });

  afterAll(async () => {
    try {
      await dropTestSchema(dataSource);
    } catch {
      // ignore
    }
    await app.close();
  });

  // ==================== 1. Auth Login ====================
  describe('POST /api/v1/auth/login', () => {
    it('201: admin login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000001', password: 'admin123' })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      adminToken = data.accessToken;
      adminRefreshToken = data.refreshToken;
    });

    it('201: staff login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000002', password: 'staff123' })
        .expect(201);

      const data = res.body.data || res.body;
      staffToken = data.accessToken;
      expect(staffToken).toBeTruthy();
    });

    it('400: invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: 'abc', password: '123456' })
        .expect(400);
    });

    it('400: password too short', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000001', password: '12' })
        .expect(400);
    });

    it('401: wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000001', password: 'wrongpassword' })
        .expect(401);
    });

    it('401: non-existent phone', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13899999999', password: '123456' })
        .expect(401);
    });
  });

  // ==================== 2. Token Refresh ====================
  describe('POST /api/v1/auth/refresh', () => {
    it('201: refresh with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: adminRefreshToken })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
    });

    it('401: refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });

    it('401: refresh with empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  // ==================== 3. Store Admin CRUD ====================
  describe('Store Admin CRUD', () => {
    it('201: create store', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Store',
          address: '北京市朝阳区测试路100号',
          phone: '13812345678',
          region: 'north',
        })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E Test Store');
      expect(data.id).toBeDefined();
      createdStoreId = data.id;
    });

    it('409: duplicate store name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Test Store', phone: '13812345679' })
        .expect(409);
    });

    it('200: get store by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E Test Store');
    });

    it('200: list stores', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data).toBeDefined();
    });

    it('200: update store name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Updated Store' })
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E Updated Store');
    });

    it('400: update with invalid status value', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'closed' })
        .expect(400);
    });

    it('200: soft delete store', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('403: staff role cannot access admin endpoints', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Unauthorized Store' })
        .expect(403);
    });
  });

  // ==================== 4. Auth Guard ====================
  describe('Auth Guard', () => {
    it('401: no token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .expect(401);
    });

    it('401: invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', 'Bearer invalid-jwt-token-here')
        .expect(401);
    });

    it('401: malformed auth header (no Bearer)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', 'NotBearer sometoken')
        .expect(401);
    });
  });
});
