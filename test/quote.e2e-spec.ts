import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Quote } from '../src/modules/quote/entities/quote.entity';
import { Configuration } from '../src/modules/configuration/entities/configuration.entity';
import { PartColor } from '../src/modules/configuration/entities/part-color.entity';
import { JwtService } from '@nestjs/jwt';

describe('Quote (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let quoteRepo: Repository<Quote>;
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
      .overrideProvider(getRepositoryToken(Quote))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        findAndCount: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Configuration))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(PartColor))
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
    quoteRepo = moduleFixture.get(getRepositoryToken(Quote));
    jwtService = moduleFixture.get(JwtService);

    validToken = jwtService.sign(
      {
        sub: 1,
        store_id: 1,
        role: 'staff',
        phone: '13800138000',
        token_version: 0,
        jti: 'quote-jti',
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

  describe('POST /api/v1/quotes', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .send({ configuration_id: 1 })
        .expect(401);
    });

    it('should return 400 when configuration_id is missing', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when configuration_id is not a positive integer', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ configuration_id: 0 })
        .expect(400);
    });
  });

  describe('GET /api/v1/quotes', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/quotes')
        .expect(401);
    });

    it('should return paginated quotes when authenticated', async () => {
      mockStaffAuth();
      (quoteRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/api/v1/quotes')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/quotes/:id', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/quotes/1')
        .expect(401);
    });

    it('should return 400 when id is not a number', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .get('/api/v1/quotes/abc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/quotes/:id', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/quotes/1')
        .expect(401);
    });
  });
});
