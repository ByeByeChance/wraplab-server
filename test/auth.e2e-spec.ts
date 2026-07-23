import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { JwtService } from '@nestjs/jwt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let jwtService: JwtService;

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

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 for invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '12345', password: '123456' })
        .expect(400);
    });

    it('should return 400 when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800138000', password: '12' })
        .expect(400);
    });

    it('should return 401 when credentials are wrong', async () => {
      (staffRepo.findOne as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: '13800138000', password: '123456' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 401 when refreshToken is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/send-sms-code', () => {
    it('should return 400 for invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-sms-code')
        .send({ phone: '12345' })
        .expect(400);
    });

    it('should return 400 when phone is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-sms-code')
        .send({})
        .expect(400);
    });

    it('should return 400 for non-mobile phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-sms-code')
        .send({ phone: '12345678901' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/sms-login', () => {
    it('should return 400 when sms_code is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/sms-login')
        .send({ phone: '13800138000' })
        .expect(400);
    });

    it('should return 400 when sms_code is not 6 digits', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/sms-login')
        .send({ phone: '13800138000', sms_code: '123' })
        .expect(400);
    });

    it('should return 400 for invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/sms-login')
        .send({ phone: '12345', sms_code: '123456' })
        .expect(400);
    });
  });

  describe('POST /api/v1/stores/switch', () => {
    let validToken: string;

    beforeAll(() => {
      // Generate a valid token for authenticated tests
      validToken = jwtService.sign(
        {
          sub: 1,
          store_id: 1,
          role: 'staff',
          phone: '13800138000',
          token_version: 0,
          jti: 'test-jti',
        },
        { secret: process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-e2e' },
      );
    });

    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/stores/switch')
        .send({ target_store_id: 2 })
        .expect(401);
    });

    it('should return 400 when target_store_id is missing', async () => {
      // Mock JWT strategy to accept the token
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

      await request(app.getHttpServer())
        .post('/api/v1/stores/switch')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when target_store_id is not a positive integer', async () => {
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

      await request(app.getHttpServer())
        .post('/api/v1/stores/switch')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ target_store_id: 0 })
        .expect(400);
    });
  });

  describe('Unauthenticated business API', () => {
    it('should return 401 for protected endpoints without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/configurations')
        .expect(401);
    });
  });
});
