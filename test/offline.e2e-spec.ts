import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Case } from '../src/modules/case/entities/case.entity';
import { CarModel } from '../src/modules/vehicle/entities/car-model.entity';
import { ColorSwatch } from '../src/modules/color/entities/color-swatch.entity';
import { ColorBrand } from '../src/modules/color/entities/color-brand.entity';
import { JwtService } from '@nestjs/jwt';

describe('Offline (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
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
      .overrideProvider(getRepositoryToken(Case))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CarModel))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(ColorSwatch))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(ColorBrand))
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

    validToken = jwtService.sign(
      {
        sub: 1,
        store_id: 1,
        role: 'staff',
        phone: '13800138000',
        token_version: 0,
        jti: 'offline-jti',
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

  describe('GET /api/v1/offline/manifest', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/offline/manifest')
        .expect(401);
    });

    it('should return manifest when authenticated', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .get('/api/v1/offline/manifest')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });

    it('should accept optional since query param', async () => {
      mockStaffAuth();

      await request(app.getHttpServer())
        .get('/api/v1/offline/manifest?since=2026-01-01')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });
});
