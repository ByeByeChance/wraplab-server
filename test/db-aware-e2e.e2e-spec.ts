/**
 * 数据库无关的全链路 E2E 测试
 * - SQLite:  自动建表 + 销毁
 * - MySQL:   使用已迁移的 wraplab_test 库，仅清理种子数据
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { StoreLocation } from '../src/modules/store-location/entities/store-location.entity';
import { createTestSchema, dropTestSchema } from './helpers/sqlite-schema';

/* eslint-disable no-console */

const TEST_PHONES = ['13800000001', '13800000002'];
const isSqlite = (): boolean => {
  const db = process.env.DB_TYPE || 'mysql';
  return db === 'sqljs' || db === 'sqlite' || db === 'better-sqlite3';
};

describe('Database-Aware E2E — Full Business Flows', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let locationRepo: Repository<StoreLocation>;

  let adminToken: string;
  let adminRefreshToken: string;
  let staffToken: string;
  let createdStoreId: number;

  const log = (...args: unknown[]) => {
    if (process.env.VERBOSE) console.log(...args);
  };

  beforeAll(async () => {
    const dbLabel = isSqlite() ? 'SQLite' : 'MySQL';
    log(`\n  DB: ${dbLabel}`);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    if (isSqlite()) {
      await createTestSchema(dataSource);
    }

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    locationRepo = moduleFixture.get(getRepositoryToken(StoreLocation));
  });

  afterAll(async () => {
    if (isSqlite()) {
      try { await dropTestSchema(dataSource); } catch { /* ignore */ }
    }
    await app.close();
  });

  // Helper: seed base data before each auth-dependent test
  async function seedBase() {
    // Clean previous test data
    if (!isSqlite()) {
      await dataSource.query('DELETE FROM store_location WHERE store_id IN (SELECT id FROM store WHERE phone IN (?, ?))', TEST_PHONES);
      await dataSource.query('DELETE FROM staff WHERE phone IN (?, ?)', TEST_PHONES);
      await dataSource.query('DELETE FROM store WHERE phone IN (?, ?) OR name LIKE ?', ['010-88888888', '13811122233', 'E2E%']);
    }

    const store = await storeRepo.save(
      storeRepo.create({
        name: 'E2E Default Store',
        address: 'Test Address',
        phone: '010-88888888',
        status: 'active',
        region: 'north',
      }),
    );

    const adminHash = await bcrypt.hash('admin123', 4);
    await staffRepo.save(
      staffRepo.create({
        store_id: store.id,
        current_store_id: store.id,
        name: 'Admin',
        phone: '13800000001',
        password_hash: adminHash,
        role: 'admin',
        status: 'active',
        token_version: 0,
      }),
    );

    const staffHash = await bcrypt.hash('staff123', 4);
    await staffRepo.save(
      staffRepo.create({
        store_id: store.id,
        current_store_id: store.id,
        name: 'Staff User',
        phone: '13800000002',
        password_hash: staffHash,
        role: 'staff',
        status: 'active',
        token_version: 0,
      }),
    );

    // Seed store location for nearby query
    await locationRepo.save(
      locationRepo.create({
        store_id: store.id,
        lat: 39.9042,
        lng: 116.4074,
        address: 'Test Address',
        province: 'Beijing',
        city: 'Beijing',
        district: 'Chaoyang',
      }),
    );
  }

  // ==================== 1. Auth Login ====================
  describe('POST /api/v1/auth/login', () => {
    beforeAll(() => seedBase());

    it('201: admin login returns access + refresh tokens', async () => {
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

    it('201: staff login returns access + refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000002', password: 'staff123' })
        .expect(201);

      const data = res.body.data || res.body;
      staffToken = data.accessToken;
      expect(staffToken).toBeTruthy();
    });

    it('400: invalid phone format rejected', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: 'abc', password: '123456' })
        .expect(400);
    });

    it('400: password too short rejected', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000001', password: '12' })
        .expect(400);
    });

    it('401: wrong password returns unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800000001', password: 'wrongpassword' })
        .expect(401);
      expect(res.body.message).toBeTruthy();
    });

    it('401: non-existent phone returns unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13899999999', password: '123456' })
        .expect(401);
      expect(res.body.message).toBeTruthy();
    });
  });

  // ==================== 2. Token Refresh ====================
  describe('POST /api/v1/auth/refresh', () => {
    it('201: refresh with valid refresh token', async () => {
      expect(adminRefreshToken).toBeTruthy();
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: adminRefreshToken })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      adminRefreshToken = data.refreshToken; // update for next test
    });

    it('401: refresh with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
      expect(res.body.message).toBeTruthy();
    });

    it('401: refresh with empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  // ==================== 3. Client Store Endpoints ====================
  describe('Client Store APIs', () => {
    it('200: nearby stores returns store list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stores/nearby?lat=39.9042&lng=116.4074&radius=5000')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].store_name).toBeTruthy();
      expect(parseFloat(data[0].distance)).toBe(0); // same coordinates
    });

    it('200: current store returns store info', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/stores/current')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E Default Store');
      expect(data.address).toBeTruthy();
      expect(data.phone).toBeTruthy();
    });

    // store-switch requires Redis + staff_store junction table;
    // verified separately in verify-flows.ts with full integration setup
  });

  // ==================== 4. Store Admin CRUD ====================
  describe('Store Admin CRUD', () => {
    it('201: create store', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E MySQL New Store',
          address: '北京市朝阳区测试路100号',
          phone: '13812345678',
          region: 'north',
        })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E MySQL New Store');
      expect(data.id).toBeDefined();
      createdStoreId = Number(data.id);
    });

    it('409: duplicate store name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E MySQL New Store', phone: '13812345679' })
        .expect(409);
    });

    it('200: get store by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E MySQL New Store');
    });

    it('200: list stores with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data).toBeDefined();
      expect(data.items).toBeDefined();
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('200: update store name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/stores/${createdStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Updated Store Name' })
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('E2E Updated Store Name');
    });

    it('400: invalid status value rejected', async () => {
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
  });

  // ==================== 5. Vehicles API ====================
  describe('Vehicles API', () => {
    it('200: list car brands', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles/brands')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('404: get non-existent brand', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles/brands/99999')
        .expect(404);
    });
  });

  // ==================== 6. Auth Guard ====================
  describe('Auth Guard', () => {
    it('403: staff role cannot access admin endpoints', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Unauthorized Store' })
        .expect(403);

      expect(res.body.code).toBeGreaterThan(0);
      expect(res.body.message).toBeTruthy();
    });

    it('401: no token provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .expect(401);

      expect(res.body.message).toBeTruthy();
    });

    it('401: invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', 'Bearer invalid-jwt-token-here')
        .expect(401);

      expect(res.body.message).toBeTruthy();
    });

    it('401: malformed auth header (no Bearer)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stores')
        .set('Authorization', 'NotBearer sometoken')
        .expect(401);

      expect(res.body.message).toBeTruthy();
    });
  });
});
