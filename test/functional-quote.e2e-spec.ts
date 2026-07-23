/**
 * Quote 模块 — 真实功能 E2E 测试
 *
 * 覆盖: 创建报价 / 查询报价列表 / 查询报价详情(含价格明细) / 删除报价 / 异常路径
 * 依赖: Configuration → CarModel → CarSeries → CarBrand + PartColor → ColorSwatch + Material
 *
 * 运行: npm run test:e2e:mysql -- --testPathPattern="functional-quote"
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
import { CarBrand } from '../src/modules/vehicle/entities/car-brand.entity';
import { CarSeries } from '../src/modules/vehicle/entities/car-series.entity';
import { CarModel } from '../src/modules/vehicle/entities/car-model.entity';
import { ColorBrand } from '../src/modules/color/entities/color-brand.entity';
import { ColorSwatch } from '../src/modules/color/entities/color-swatch.entity';
import { Material } from '../src/modules/color/entities/material.entity';
import { Configuration } from '../src/modules/configuration/entities/configuration.entity';
import { PartColor } from '../src/modules/configuration/entities/part-color.entity';
import { Quote } from '../src/modules/quote/entities/quote.entity';
import { createTestSchema, dropTestSchema } from './helpers/sqlite-schema';

/* eslint-disable no-console */

const isSqlite = (): boolean => {
  const db = process.env.DB_TYPE || 'mysql';
  return db === 'sqljs' || db === 'sqlite' || db === 'better-sqlite3';
};

describe('Quote 功能测试 (真实数据库)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Repositories for seeding
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let brandRepo: Repository<CarBrand>;
  let seriesRepo: Repository<CarSeries>;
  let modelRepo: Repository<CarModel>;
  let colorBrandRepo: Repository<ColorBrand>;
  let swatchRepo: Repository<ColorSwatch>;
  let materialRepo: Repository<Material>;
  let configRepo: Repository<Configuration>;
  let partColorRepo: Repository<PartColor>;
  let quoteRepo: Repository<Quote>;

  let staffToken: string;
  let storeId: number;
  let modelId: number;
  let configId: number;
  let quotedConfigId: number;

  const TEST_PHONE = '13899999001';
  const TEST_PASSWORD = 'test123';

  beforeAll(async () => {
    const log = process.env.VERBOSE ? console.log : () => {};
    log(`DB type: ${isSqlite() ? 'SQLite' : 'MySQL'}`);

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

    // Get repos
    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    brandRepo = moduleFixture.get(getRepositoryToken(CarBrand));
    seriesRepo = moduleFixture.get(getRepositoryToken(CarSeries));
    modelRepo = moduleFixture.get(getRepositoryToken(CarModel));
    colorBrandRepo = moduleFixture.get(getRepositoryToken(ColorBrand));
    swatchRepo = moduleFixture.get(getRepositoryToken(ColorSwatch));
    materialRepo = moduleFixture.get(getRepositoryToken(Material));
    configRepo = moduleFixture.get(getRepositoryToken(Configuration));
    partColorRepo = moduleFixture.get(getRepositoryToken(PartColor));
    quoteRepo = moduleFixture.get(getRepositoryToken(Quote));

    // ---- Cleanup previous test data ----
    const TEST_STORE_NAME = 'Quote Test Store';
    const existingStore = await storeRepo.findOne({ where: { name: TEST_STORE_NAME } as any });
    if (existingStore) {
      await quoteRepo.delete({ store_id: existingStore.id } as any);
      await partColorRepo.delete({ store_id: existingStore.id } as any);
      await configRepo.delete({ store_id: existingStore.id } as any);
      await staffRepo.delete({ store_id: existingStore.id } as any);
      await storeRepo.delete({ id: existingStore.id } as any);
    }
    // Cleanup vehicle/color test data
    await partColorRepo.delete({ part_code: 'hood' } as any);
    await quoteRepo.delete({ total_price: 4500 } as any);
    await configRepo.delete({ name: 'Test Config' } as any);
    await configRepo.delete({ name: 'Already Quoted' } as any);
    await swatchRepo.delete({ name: 'Matte Black' } as any);
    await materialRepo.delete({ name: 'Premium Film' } as any);
    await colorBrandRepo.delete({ name: 'Quote Test ColorBrand' } as any);
    await modelRepo.delete({ name: 'Quote Test Model' } as any);
    await seriesRepo.delete({ name: 'Quote Test Series' } as any);
    await brandRepo.delete({ name: 'Quote Test Brand' } as any);

    // ---- Seed full dependency chain ----
    // 1. Store
    const store = await storeRepo.save(
      storeRepo.create({ name: 'Quote Test Store', address: 'Beijing', phone: '010-quote0001', status: 'active', region: 'north' }),
    );
    storeId = store.id;

    // 2. Staff with JWT
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await staffRepo.save({
      store_id: storeId, current_store_id: storeId, name: 'Quote Tester',
      phone: TEST_PHONE, password_hash: hash, role: 'staff', status: 'active', token_version: 0,
    } as Partial<Staff>);

    // 3. Vehicle hierarchy: Brand → Series → Model
    const brand = await brandRepo.save(brandRepo.create({ name: 'Quote Test Brand' }));
    const series = await seriesRepo.save(seriesRepo.create({ brand_id: brand.id, name: 'Quote Test Series' }));
    const model = await modelRepo.save(modelRepo.create({ series_id: series.id, name: 'Quote Test Model', year: 2025 }));
    modelId = model.id;

    // 4. Color hierarchy: ColorBrand → ColorSwatch (with price)
    const cb = await colorBrandRepo.save(colorBrandRepo.create({ name: 'Quote Test ColorBrand' }));
    const swatch = await swatchRepo.save({
      brand_id: cb.id, name: 'Matte Black', hex: '#000000',
      rgb_r: 0, rgb_g: 0, rgb_b: 0, price_per_m2: 200,
    } as Partial<ColorSwatch>);
    const mat = await materialRepo.save({ name: 'Premium Film', price_multiplier: 1.5 } as Partial<Material>);

    // 5. Configuration (draft — ready to quote)
    const config = await configRepo.save({
      store_id: storeId, model_id: modelId, staff_id: 1, name: 'Test Config', status: 'draft',
    } as Partial<Configuration>);
    configId = config.id;

    // 6. PartColor — links configuration to color/material
    await partColorRepo.save({
      store_id: storeId, configuration_id: configId, part_code: 'hood',
      color_swatch_id: swatch.id, material_id: mat.id,
    } as Partial<PartColor>);

    // 7. Another config that is already quoted (for error testing)
    const qc = await configRepo.save({
      store_id: storeId, model_id: modelId, staff_id: 1, name: 'Already Quoted', status: 'quoted',
    } as Partial<Configuration>);
    quotedConfigId = qc.id;

    // Login to get staff token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: TEST_PHONE, password: TEST_PASSWORD });
    staffToken = loginRes.body.data?.accessToken || loginRes.body.accessToken || '';
  });

  afterAll(async () => {
    if (isSqlite()) {
      try { await dropTestSchema(dataSource); } catch { /* ignore */ }
    }
    await app.close();
  });

  // ==================== CREATE ====================
  describe('POST /api/v1/quotes — 创建报价', () => {
    it('201: 基于有效配置创建报价，返回价格明细', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ configuration_id: configId })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.store_id).toBe(storeId);
      expect(data.configuration_id).toBe(configId);
      expect(parseFloat(data.total_price)).toBeGreaterThan(0);
      // 15 m² × 200 ¥/m² × 1.5 = 4500
      expect(parseFloat(data.total_price)).toBe(4500);
      expect(data.status).toBe('pending');
    });

    it('400: 缺少 configuration_id 参数', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(400);
    });

    it('400: 无效的 configuration_id (非数字)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ configuration_id: 'not-a-number' })
        .expect(400);
    });

    it('404: 引用不存在的 configuration_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ configuration_id: 99999 })
        .expect(404); // CONFIGURATION_NOT_FOUND → 404
    });

    it('201: 再次创建相同配置的报价应成功（一个配置可多次报价）', async () => {
      // Reset config status back to draft so we can quote again
      await configRepo.update(configId, { status: 'draft' } as Partial<Configuration>);

      const res = await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ configuration_id: configId })
        .expect(201);

      expect(res.body.code).toBe(0);
    });
  });

  // ==================== LIST ====================
  describe('GET /api/v1/quotes — 查询报价列表', () => {
    it('200: 返回分页报价列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotes?page=1&size=10')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(Array.isArray(data.list)).toBe(true);
      expect(data.list.length).toBeGreaterThan(0);
      expect(data.total).toBeGreaterThan(0);
      expect(data.list[0].store_id).toBe(storeId);
      // Should include configuration relation
      expect(data.list[0].configuration).toBeDefined();
    });

    it('200: 第二页为空时返回空列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotes?page=99&size=10')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(Array.isArray(data.list)).toBe(true);
      expect(data.list.length).toBe(0);
    });
  });

  // ==================== GET BY ID ====================
  describe('GET /api/v1/quotes/:id — 查询报价详情', () => {
    let quoteId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotes?page=1&size=1')
        .set('Authorization', `Bearer ${staffToken}`);
      const list = res.body.data?.list || [];
      if (list.length > 0) quoteId = list[0].id;
    });

    it('200: 返回完整报价详情含价格明细', async () => {
      expect(quoteId).toBeDefined();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.id).toBe(quoteId);
      expect(data.total_price).toBeDefined();
      expect(data.configuration).toBeDefined();
      // Should include price_details array
      expect(data.price_details).toBeDefined();
      expect(Array.isArray(data.price_details)).toBe(true);
      if (data.price_details.length > 0) {
        const detail = data.price_details[0];
        expect(detail.part_code).toBeDefined();
        expect(detail.part_area).toBeDefined();
        expect(detail.subtotal).toBeDefined();
      }
    });

    it('404: 查询不存在的报价单', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/quotes/99999')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('400: 无效的报价ID参数', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/quotes/abc')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);
    });
  });

  // ==================== DELETE ====================
  describe('DELETE /api/v1/quotes/:id — 删除报价', () => {
    let delQuoteId: number;

    beforeAll(async () => {
      // Reset config status and create a fresh quote for deletion test
      await configRepo.update(configId, { status: 'draft' } as Partial<Configuration>);
      const res = await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ configuration_id: configId });
      delQuoteId = (res.body.data || res.body).id;
    });

    it('200: 软删除报价成功', async () => {
      expect(delQuoteId).toBeDefined();
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/quotes/${delQuoteId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
    });

    it('404: 重复删除返回 404', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/quotes/${delQuoteId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });
  });

  // ==================== AUTH ====================
  describe('Quote 鉴权验证', () => {
    it('401: 无 token 访问报价接口', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/quotes')
        .expect(401);
    });
  });
});
