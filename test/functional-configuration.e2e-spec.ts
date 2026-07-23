/**
 * Configuration 模块 — 真实功能 E2E 测试
 *
 * 覆盖: 创建选色配置 / 查询配置列表(含状态过滤) / 查询配置详情 / 更新配置 / 删除配置(级联) / 异常路径 / 多租户隔离
 * 依赖: CarBrand → CarSeries → CarModel + ColorBrand → ColorSwatch + Material
 *
 * 运行: npm run test:e2e:mysql -- --testPathPattern="functional-config"
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

describe('Configuration 功能测试 (真实数据库)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
  let staffTokenB: string;
  let storeId: number;
  let storeBId: number;
  let modelId: number;
  let swatchId: number;
  let swatch2Id: number;
  let materialId: number;
  let material2Id: number;

  const TEST_PHONE = '13899999002';
  const TEST_PHONE_B = '13899999003';
  const TEST_PASSWORD = 'test123';

  beforeAll(async () => {
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
    brandRepo = moduleFixture.get(getRepositoryToken(CarBrand));
    seriesRepo = moduleFixture.get(getRepositoryToken(CarSeries));
    modelRepo = moduleFixture.get(getRepositoryToken(CarModel));
    colorBrandRepo = moduleFixture.get(getRepositoryToken(ColorBrand));
    swatchRepo = moduleFixture.get(getRepositoryToken(ColorSwatch));
    materialRepo = moduleFixture.get(getRepositoryToken(Material));
    configRepo = moduleFixture.get(getRepositoryToken(Configuration));
    partColorRepo = moduleFixture.get(getRepositoryToken(PartColor));
    quoteRepo = moduleFixture.get(getRepositoryToken(Quote));

    // ---- Cleanup ----
    const STORE_A = 'Config Test Store A';
    const STORE_B = 'Config Test Store B';
    for (const name of [STORE_A, STORE_B]) {
      const s = await storeRepo.findOne({ where: { name } as any });
      if (s) {
        await quoteRepo.delete({ store_id: s.id } as any);
        await partColorRepo.delete({ store_id: s.id } as any);
        await configRepo.delete({ store_id: s.id } as any);
        await staffRepo.delete({ store_id: s.id } as any);
        await storeRepo.delete({ id: s.id } as any);
      }
    }
    await swatchRepo.delete({ name: 'Gloss Red' } as any);
    await swatchRepo.delete({ name: 'Matte Blue' } as any);
    await materialRepo.delete({ name: 'Standard Film' } as any);
    await materialRepo.delete({ name: 'Premium Film' } as any);
    await colorBrandRepo.delete({ name: 'Config Test ColorBrand' } as any);
    await modelRepo.delete({ name: 'Config Test Model' } as any);
    await seriesRepo.delete({ name: 'Config Test Series' } as any);
    await brandRepo.delete({ name: 'Config Test Brand' } as any);

    // ---- Seed ----
    // Store A
    const storeA = await storeRepo.save(
      storeRepo.create({ name: STORE_A, address: 'Beijing', phone: '010-cfg0001', status: 'active', region: 'north' }),
    );
    storeId = storeA.id;

    // Store B (for cross-tenant testing)
    const storeB = await storeRepo.save(
      storeRepo.create({ name: STORE_B, address: 'Shanghai', phone: '010-cfg0002', status: 'active', region: 'east' }),
    );
    storeBId = storeB.id;

    // Staff A
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await staffRepo.save({
      store_id: storeId, current_store_id: storeId, name: 'Config Tester A',
      phone: TEST_PHONE, password_hash: hash, role: 'staff', status: 'active', token_version: 0,
    } as Partial<Staff>);

    // Staff B
    await staffRepo.save({
      store_id: storeBId, current_store_id: storeBId, name: 'Config Tester B',
      phone: TEST_PHONE_B, password_hash: hash, role: 'staff', status: 'active', token_version: 0,
    } as Partial<Staff>);

    // Vehicle hierarchy
    const brand = await brandRepo.save(brandRepo.create({ name: 'Config Test Brand' }));
    const series = await seriesRepo.save(seriesRepo.create({ brand_id: brand.id, name: 'Config Test Series' }));
    const model = await modelRepo.save(modelRepo.create({ series_id: series.id, name: 'Config Test Model', year: 2025 }));
    modelId = model.id;

    // Color hierarchy
    const cb = await colorBrandRepo.save(colorBrandRepo.create({ name: 'Config Test ColorBrand' }));
    const swatch1 = await swatchRepo.save({
      brand_id: cb.id, name: 'Gloss Red', hex: '#FF0000',
      rgb_r: 255, rgb_g: 0, rgb_b: 0, price_per_m2: 150,
    } as Partial<ColorSwatch>);
    swatchId = swatch1.id;

    const swatch2 = await swatchRepo.save({
      brand_id: cb.id, name: 'Matte Blue', hex: '#0000FF',
      rgb_r: 0, rgb_g: 0, rgb_b: 255, price_per_m2: 180,
    } as Partial<ColorSwatch>);
    swatch2Id = swatch2.id;

    const mat1 = await materialRepo.save({ name: 'Standard Film', price_multiplier: 1.0 } as Partial<Material>);
    materialId = mat1.id;

    const mat2 = await materialRepo.save({ name: 'Premium Film', price_multiplier: 1.5 } as Partial<Material>);
    material2Id = mat2.id;

    // Login both staff
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: TEST_PHONE, password: TEST_PASSWORD });
    staffToken = loginA.body.data?.accessToken || loginA.body.accessToken || '';

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: TEST_PHONE_B, password: TEST_PASSWORD });
    staffTokenB = loginB.body.data?.accessToken || loginB.body.accessToken || '';
  });

  afterAll(async () => {
    if (isSqlite()) {
      try { await dropTestSchema(dataSource); } catch { /* ignore */ }
    }
    await app.close();
  });

  // ==================== CREATE ====================
  describe('POST /api/v1/configurations — 创建选色配置', () => {
    it('201: 最小字段创建，自动生成 part_code=FULL 的 PartColor', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId, material_id: materialId })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.store_id).toBe(storeId);
      expect(data.model_id).toBe(modelId);
      expect(data.status).toBe('draft');
      expect(data.name).toBeNull();
      expect(data.partColors).toBeDefined();
      expect(data.partColors.length).toBe(1);
      expect(data.partColors[0].part_code).toBe('FULL');
      expect(data.partColors[0].color_swatch_id).toBe(swatchId);
      expect(data.partColors[0].material_id).toBe(materialId);
    });

    it('201: 全字段创建（含客户信息）', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          model_id: modelId, color_swatch_id: swatchId, material_id: materialId,
          name: 'Full Config', note: 'Some note', customer_name: 'Alice', customer_phone: '13900001111',
        })
        .expect(201);

      const data = res.body.data || res.body;
      expect(data.name).toBe('Full Config');
      expect(data.note).toBe('Some note');
      expect(data.customer_name).toBe('Alice');
      expect(data.customer_phone).toBe('13900001111');
    });

    it('201: HTML 标签在 note 和 customer_name 中被清理', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          model_id: modelId, color_swatch_id: swatchId, material_id: materialId,
          name: 'Safe Name',
          customer_name: '<b>Bob</b>',
          note: '<script>alert("xss")</script>hello',
        })
        .expect(201);

      const data = res.body.data || res.body;
      // customer_name and note should be sanitized (HTML tags stripped)
      expect(data.customer_name).not.toContain('<b>');
      expect(data.customer_name).toBe('Bob');
      expect(data.note).not.toContain('<script>');
      expect(data.note).toBe('alert(&quot;xss&quot;)hello');
    });

    it('400: 缺少 model_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ color_swatch_id: swatchId, material_id: materialId })
        .expect(400);
    });

    it('400: 缺少 color_swatch_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, material_id: materialId })
        .expect(400);
    });

    it('400: 缺少 material_id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId })
        .expect(400);
    });

    it('400: 无效手机号格式', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId, material_id: materialId, customer_phone: 'abc' })
        .expect(400);
    });

    it('404: 引用不存在的 model_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: 99999, color_swatch_id: swatchId, material_id: materialId })
        .expect(404);

      expect(res.body.message).toContain('车型');
    });

    it('404: 引用不存在的 color_swatch_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: 99999, material_id: materialId })
        .expect(404);

      expect(res.body.message).toContain('颜色');
    });

    it('404: 引用不存在的 material_id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId, material_id: 99999 })
        .expect(404);

      expect(res.body.message).toContain('材质');
    });
  });

  // ==================== LIST ====================
  describe('GET /api/v1/configurations — 查询配置列表', () => {
    it('200: 返回分页列表，按 created_at DESC 排序', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/configurations?page=1&size=10')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(Array.isArray(data.list)).toBe(true);
      expect(data.list.length).toBeGreaterThanOrEqual(1);
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.list[0].model).toBeDefined();
      // partColors should NOT be in list
      expect(data.list[0].partColors).toBeUndefined();

      // Verify DESC order
      if (data.list.length >= 2) {
        const t0 = new Date(data.list[0].created_at).getTime();
        const t1 = new Date(data.list[1].created_at).getTime();
        expect(t0).toBeGreaterThanOrEqual(t1);
      }
    });

    it('200: status 过滤', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/configurations?status=draft&page=1&size=20')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      for (const item of data.list) {
        expect(item.status).toBe('draft');
      }
    });

    it('200: 第二页为空', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/configurations?page=99&size=10')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.list.length).toBe(0);
    });

    it('200: 跨门店隔离 — Store B 看不到 Store A 的数据', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/configurations?page=1&size=20')
        .set('Authorization', `Bearer ${staffTokenB}`)
        .expect(200);

      const data = res.body.data || res.body;
      for (const item of data.list) {
        expect(item.store_id).toBe(storeBId);
      }
    });
  });

  // ==================== GET BY ID ====================
  describe('GET /api/v1/configurations/:id — 查询配置详情', () => {
    let configId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/configurations?page=1&size=1')
        .set('Authorization', `Bearer ${staffToken}`);
      const list = res.body.data?.list || [];
      configId = list[0]?.id;
    });

    it('200: 返回完整配置含关系链 (model→series→brand, partColors→swatch+material)', async () => {
      expect(configId).toBeDefined();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/configurations/${configId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.id).toBe(configId);
      expect(data.model).toBeDefined();
      expect(data.model.series).toBeDefined();
      expect(data.model.series.brand).toBeDefined();
      expect(data.partColors).toBeDefined();
      expect(Array.isArray(data.partColors)).toBe(true);
      expect(data.partColors.length).toBeGreaterThanOrEqual(1);
      expect(data.partColors[0].colorSwatch).toBeDefined();
      expect(data.partColors[0].material).toBeDefined();
    });

    it('404: 查询不存在的配置', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/configurations/99999')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('400: 无效的 ID 参数', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/configurations/abc')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);
    });

    it('404: 跨门店无法访问对方配置', async () => {
      expect(configId).toBeDefined();
      await request(app.getHttpServer())
        .get(`/api/v1/configurations/${configId}`)
        .set('Authorization', `Bearer ${staffTokenB}`)
        .expect(404);
    });
  });

  // ==================== UPDATE ====================
  describe('PUT /api/v1/configurations/:id — 更新选色配置', () => {
    let updateConfigId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          model_id: modelId, color_swatch_id: swatchId, material_id: materialId,
          name: 'Update Test', customer_name: 'Original', customer_phone: '13800001111',
        });
      updateConfigId = (res.body.data || res.body).id;
    });

    it('200: 全字段更新', async () => {
      expect(updateConfigId).toBeDefined();
      const res = await request(app.getHttpServer())
        .put(`/api/v1/configurations/${updateConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Updated Name', note: 'Updated note',
          customer_name: 'Bob', customer_phone: '13911112222',
        })
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('Updated Name');
      expect(data.note).toBe('Updated note');
      expect(data.customer_name).toBe('Bob');
      expect(data.customer_phone).toBe('13911112222');
      // model_id should be unchanged
      expect(data.model_id).toBe(modelId);
    });

    it('200: 部分更新 — 仅更新 name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/configurations/${updateConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Only Name Changed' })
        .expect(200);

      const data = res.body.data || res.body;
      expect(data.name).toBe('Only Name Changed');
      // Other fields unchanged
      expect(data.customer_name).toBe('Bob');
    });

    it('200: 更新 color_swatch 和 material，PartColor 同步更新', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/configurations/${updateConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ color_swatch_id: swatch2Id, material_id: material2Id })
        .expect(200);

      const data = res.body.data || res.body;
      const fullPart = data.partColors.find((p: any) => p.part_code === 'FULL');
      expect(fullPart).toBeDefined();
      expect(fullPart.color_swatch_id).toBe(swatch2Id);
      expect(fullPart.material_id).toBe(material2Id);
    });

    it('400: 无效手机号', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/configurations/${updateConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ customer_phone: 'not-a-phone' })
        .expect(400);
    });

    it('404: 更新不存在的配置', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/configurations/99999')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('404: 跨门店无法更新对方配置', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/configurations/${updateConfigId}`)
        .set('Authorization', `Bearer ${staffTokenB}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });
  });

  // ==================== DELETE ====================
  describe('DELETE /api/v1/configurations/:id — 删除选色配置', () => {
    let delConfigId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId, material_id: materialId, name: 'To Delete' });
      delConfigId = (res.body.data || res.body).id;
    });

    it('200: 软删除配置，级联删除 PartColor', async () => {
      expect(delConfigId).toBeDefined();
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/configurations/${delConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);

      // Verify it's gone from list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/configurations?page=1&size=50')
        .set('Authorization', `Bearer ${staffToken}`);
      const ids = (listRes.body.data?.list || []).map((i: any) => i.id);
      expect(ids).not.toContain(delConfigId);

      // Verify get by ID returns 404
      await request(app.getHttpServer())
        .get(`/api/v1/configurations/${delConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('404: 重复删除', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/configurations/${delConfigId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('404: 删除不存在的配置', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/configurations/99999')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('404: 跨门店无法删除对方配置', async () => {
      // Create a new one in Store A
      const r = await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ model_id: modelId, color_swatch_id: swatchId, material_id: materialId });
      const cid = (r.body.data || r.body).id;

      await request(app.getHttpServer())
        .delete(`/api/v1/configurations/${cid}`)
        .set('Authorization', `Bearer ${staffTokenB}`)
        .expect(404);
    });
  });

  // ==================== AUTH ====================
  describe('Configuration 鉴权验证', () => {
    it('401: 无 token 访问列表', async () => {
      await request(app.getHttpServer()).get('/api/v1/configurations').expect(401);
    });

    it('401: 无 token 创建', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/configurations')
        .send({ model_id: 1, color_swatch_id: 1, material_id: 1 })
        .expect(401);
    });

    it('401: 无 token 更新', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/configurations/1')
        .send({ name: 'X' })
        .expect(401);
    });

    it('401: 无 token 删除', async () => {
      await request(app.getHttpServer()).delete('/api/v1/configurations/1').expect(401);
    });
  });
});
