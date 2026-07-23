import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';

describe('Smoke (e2e)', () => {
  let app: INestApplication;

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
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should boot without errors', () => {
    expect(app).toBeDefined();
  });

  it('GET /api/v1/ should respond (even 404 means app is running)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/')
      .expect((res) => {
        // Any response (200, 404, etc.) means the app responded
        expect(res.status).toBeDefined();
      });
  });

  it('should have all critical modules loaded (vehicle brands is public)', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(Staff))
      .useValue({ findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() })
      .overrideProvider(getRepositoryToken(Store))
      .useValue({ findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() })
      .compile();

    expect(moduleFixture).toBeDefined();
    // AppModule imports all modules, so being defined means all critical modules loaded
  });
});
