/**
 * 跨仓库全链路验证脚本
 * 模拟: 小程序(Client) → 后端  AND  后台管理(Admin) → 后端
 *
 * 启动真实 NestJS 应用，执行真实 HTTP 请求并打印所有请求/响应。
 *
 * SQLite:
 *   DB_TYPE=better-sqlite3 JWT_ACCESS_SECRET=test JWT_REFRESH_SECRET=test NODE_ENV=test \
 *   npx ts-node -P tsconfig.json -r tsconfig-paths/register test/verify-flows.ts
 *
 * MySQL:
 *   npx ts-node -P tsconfig.json -r tsconfig-paths/register test/verify-flows.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { StoreLocation } from '../src/modules/store-location/entities/store-location.entity';
import { createTestSchema, dropTestSchema } from './helpers/sqlite-schema';

/* eslint-disable no-console */

interface Step {
  label: string;
  role: 'client' | 'admin' | 'none';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: Record<string, unknown>;
  token?: 'staff' | 'admin' | 'none';
  expectStatus: number;
}

const TEST_PHONES = ['13800000001', '13800000002'];

async function main() {
  const dbType = process.env.DB_TYPE || 'mysql';
  const isSqlite = dbType === 'sqljs' || dbType === 'sqlite' || dbType === 'better-sqlite3';

  console.log('═══ WrapLab 全链路验证 ═══');
  console.log(`DB: ${isSqlite ? 'SQLite (内存库)' : 'MySQL (localhost:3306/wraplab)'}\n`);

  // ---- Boot ----
  console.log('[1] 启动 NestJS 应用...\n');
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.init();

  const dataSource = moduleFixture.get(DataSource);

  if (isSqlite) {
    await createTestSchema(dataSource);
  } else {
    // Clean up previous test data from MySQL
    await dataSource.query('DELETE FROM store_location WHERE store_id IN (SELECT id FROM store WHERE phone IN (?, ?))', TEST_PHONES);
    await dataSource.query('DELETE FROM staff WHERE phone IN (?, ?)', TEST_PHONES);
    await dataSource.query('DELETE FROM store WHERE phone IN (?, ?) OR name LIKE ?', ['010-88888888', '13811122233', 'WrapLab%']);
  }

  const staffRepo = moduleFixture.get(getRepositoryToken(Staff));
  const storeRepo = moduleFixture.get(getRepositoryToken(Store));
  const locationRepo = moduleFixture.get(getRepositoryToken(StoreLocation));

  // ---- Seed ----
  console.log('[2] 种子数据: 创建门店 + 管理员 + 店员...\n');

  const store = await storeRepo.save(
    storeRepo.create({
      name: 'WrapLab 旗舰店',
      address: '北京市朝阳区建国路88号',
      phone: '010-88888888',
      status: 'active',
      region: 'north',
    }),
  );
  console.log(`  ✓ 门店创建: WrapLab 旗舰店 (id=${store.id})`);

  // Seed store location for nearby query
  await locationRepo.save(
    locationRepo.create({
      store_id: store.id,
      lat: 39.9042,
      lng: 116.4074,
      address: '北京市朝阳区建国路88号',
      province: '北京',
      city: '北京',
      district: '朝阳区',
    }),
  );
  console.log('  ✓ 门店坐标: (39.9042, 116.4074)');

  const adminHash = await bcrypt.hash('admin123', 4);
  await staffRepo.save(
    staffRepo.create({
      store_id: store.id,
      current_store_id: store.id,
      name: '管理员张三',
      phone: '13800000001',
      password_hash: adminHash,
      role: 'admin',
      status: 'active',
      token_version: 0,
    }),
  );
  console.log('  ✓ 管理员: 13800000001 / admin123 (role=admin)');

  const staffHash = await bcrypt.hash('staff123', 4);
  await staffRepo.save(
    staffRepo.create({
      store_id: store.id,
      current_store_id: store.id,
      name: '店员李四',
      phone: '13800000002',
      password_hash: staffHash,
      role: 'staff',
      status: 'active',
      token_version: 0,
    }),
  );
  console.log('  ✓ 店员: 13800000002 / staff123 (role=staff)\n');

  // ---- Execute flows ----
  const server = app.getHttpServer();
  let adminToken = '';
  let staffToken = '';
  let staffRefreshToken = '';
  let createdStoreId = 0;

  const steps: Step[] = [
    // ====== 小程序 Client Flow ======
    { label: '小程序-登录(店员)', role: 'client', method: 'POST', url: '/api/v1/auth/login', body: { phone: '13800000002', password: 'staff123' }, expectStatus: 201 },
    { label: '小程序-附近门店', role: 'client', method: 'GET', url: '/api/v1/stores/nearby?lat=39.9042&lng=116.4074&radius=5000', token: 'staff', expectStatus: 200 },
    { label: '小程序-当前门店', role: 'client', method: 'GET', url: '/api/v1/stores/current', token: 'staff', expectStatus: 200 },
    { label: '小程序-刷新Token', role: 'client', method: 'POST', url: '/api/v1/auth/refresh', token: 'none', expectStatus: 201 },

    // ====== 后台管理 Admin Flow ======
    { label: '后台-登录(管理员)', role: 'admin', method: 'POST', url: '/api/v1/auth/login', body: { phone: '13800000001', password: 'admin123' }, expectStatus: 201 },
    { label: '后台-创建新门店', role: 'admin', method: 'POST', url: '/api/v1/admin/stores', body: { name: 'WrapLab 望京分店', address: '北京市朝阳区望京SOHO', phone: '13811122233', region: 'north' }, expectStatus: 201 },
    { label: '后台-查所有门店', role: 'admin', method: 'GET', url: '/api/v1/admin/stores', expectStatus: 200 },
    { label: '后台-更新门店名', role: 'admin', method: 'PUT', url: '/api/v1/admin/stores/{createdStoreId}', body: { name: 'WrapLab 望京旗舰店' }, expectStatus: 200 },
    { label: '后台-删除门店(软删除)', role: 'admin', method: 'DELETE', url: '/api/v1/admin/stores/{createdStoreId}', expectStatus: 200 },

    // ====== 权限校验 ======
    { label: '权限-店员访问管理接口(应403)', role: 'client', method: 'POST', url: '/api/v1/admin/stores', body: { name: 'Hack Store' }, token: 'staff', expectStatus: 403 },
    { label: '权限-无Token访问(应401)', role: 'none', method: 'GET', url: '/api/v1/admin/stores', token: 'none', expectStatus: 401 },
  ];

  const results: { label: string; ok: boolean; status: number; expected: number }[] = [];

  let stepNum = 3;
  for (const step of steps) {
    let token = '';
    if (step.token === 'staff') token = staffToken;
    else if (step.token === 'admin') token = adminToken;
    else if (step.token === 'none') token = '';
    else if (step.role === 'admin') token = adminToken;
    else if (step.role === 'client') token = staffToken;

    let url = step.url.replace('{createdStoreId}', String(createdStoreId));

    let body = step.body ? { ...step.body } : undefined;
    if (step.label.includes('刷新Token') && staffRefreshToken) {
      body = { refreshToken: staffRefreshToken };
    }

    console.log(`[${stepNum}] ${step.label}`);
    console.log(`    ${step.method} ${url}`);
    if (body) console.log(`    Body: ${JSON.stringify(body)}`);
    if (token) console.log(`    Auth: Bearer ${token.substring(0, 20)}...`);
    else console.log(`    Auth: (none)`);

    let req = request(server)[step.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](url);
    if (body) req = req.send(body);
    if (token) req = req.set('Authorization', `Bearer ${token}`);

    const res = await req;
    const status = res.status;
    const bodyData = res.body;

    const ok = status === step.expectStatus;
    if (ok) {
      console.log(`    ✓ HTTP ${status}`);
    } else {
      console.log(`    ✗ HTTP ${status} (expected ${step.expectStatus})`);
    }

    const bodyStr = JSON.stringify(bodyData);
    const truncated = bodyStr.length > 400 ? bodyStr.substring(0, 400) + '...' : bodyStr;
    console.log(`    Response: ${truncated}\n`);

    results.push({ label: step.label, ok, status, expected: step.expectStatus });

    if (step.label.includes('登录(店员)') && status === 201) {
      staffToken = bodyData.data?.accessToken || bodyData.accessToken || '';
      staffRefreshToken = bodyData.data?.refreshToken || bodyData.refreshToken || '';
      console.log(`    >> 捕获 staff accessToken + refreshToken`);
    }
    if (step.label.includes('登录(管理员)') && status === 201) {
      adminToken = bodyData.data?.accessToken || bodyData.accessToken || '';
      console.log(`    >> 捕获 admin accessToken`);
    }

    if (step.label.includes('创建新门店') && status === 201) {
      createdStoreId = bodyData.data?.id || bodyData.id || 0;
      console.log(`    >> 创建门店 id=${createdStoreId}`);
    }

    stepNum++;
  }

  // ---- Summary ----
  console.log('═══ 验证结果 ═══');
  const failures = results.filter(r => !r.ok);

  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}: HTTP ${r.status} (expected ${r.expected})`);
  }

  console.log(`\n结果: ${failures.length === 0 ? '全部通过! (' + results.length + ' 步)' : failures.length + ' / ' + results.length + ' 项失败'}`);
  if (failures.length > 0) {
    console.log('失败项:');
    failures.forEach(f => console.log(`  - ${f.label}: got HTTP ${f.status}, expected ${f.expected}`));
  }

  // Cleanup
  if (isSqlite) {
    try { await dropTestSchema(dataSource); } catch { /* ignore */ }
  } else {
    // Clean test data from MySQL
    await dataSource.query('DELETE FROM store_location WHERE store_id IN (SELECT id FROM store WHERE phone IN (?, ?))', TEST_PHONES);
    await dataSource.query('DELETE FROM staff WHERE phone IN (?, ?)', TEST_PHONES);
    await dataSource.query('DELETE FROM store WHERE phone IN (?, ?) OR name LIKE ?', ['010-88888888', '13811122233', 'WrapLab%']);
  }
  await app.close();

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
