import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Quote } from '../src/modules/quote/entities/quote.entity';
import { Appointment } from '../src/modules/appointment/entities/appointment.entity';
import { CampaignClaim } from '../src/modules/campaign/entities/campaign-claim.entity';
import { Customer } from '../src/modules/customer/entities/customer.entity';
import { JwtService } from '@nestjs/jwt';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let quoteRepo: Repository<Quote>;
  let appointmentRepo: Repository<Appointment>;
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
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
          getRawOne: jest.fn().mockResolvedValue({ revenue: '0', count: '0' }),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      })
      .overrideProvider(getRepositoryToken(Appointment))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
          getRawOne: jest.fn().mockResolvedValue({ revenue: '0', count: '0' }),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      })
      .overrideProvider(getRepositoryToken(CampaignClaim))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(Customer))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    staffRepo = moduleFixture.get(getRepositoryToken(Staff));
    storeRepo = moduleFixture.get(getRepositoryToken(Store));
    quoteRepo = moduleFixture.get(getRepositoryToken(Quote));
    appointmentRepo = moduleFixture.get(getRepositoryToken(Appointment));
    jwtService = moduleFixture.get(JwtService);

    adminToken = jwtService.sign(
      {
        sub: 1,
        store_id: 1,
        role: 'admin',
        phone: '13800138000',
        token_version: 0,
        jti: 'dash-jti',
      },
      { secret: process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-key-e2e' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const mockAdminAuth = () => {
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

  describe('GET /api/v1/admin/dashboard/overview', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/overview')
        .expect(401);
    });

    it('should return overview when authenticated as admin', async () => {
      mockAdminAuth();
      (quoteRepo.count as jest.Mock).mockResolvedValue(10);
      (appointmentRepo.count as jest.Mock).mockResolvedValue(5);

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/admin/dashboard/trends', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/trends?startDate=2026-01-01&endDate=2026-07-31&granularity=monthly')
        .expect(401);
    });
  });

  describe('GET /api/v1/admin/dashboard/comparison', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/comparison?compare_type=yoy&period=monthly')
        .expect(401);
    });

    it('should return 400 when compare_type is missing', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/comparison?period=monthly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid compare_type', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/comparison?compare_type=invalid&period=monthly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid period', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/comparison?compare_type=yoy&period=daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/admin/dashboard/drill-down', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/drill-down?metric_type=revenue&period=monthly&group_by=staff')
        .expect(401);
    });

    it('should return 400 when required params are missing', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/drill-down')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid metric_type', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/drill-down?metric_type=invalid&period=monthly&group_by=staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 for invalid group_by', async () => {
      mockAdminAuth();

      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/drill-down?metric_type=revenue&period=monthly&group_by=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
