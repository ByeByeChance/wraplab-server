import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarBrand } from '../src/modules/vehicle/entities/car-brand.entity';
import { CarSeries } from '../src/modules/vehicle/entities/car-series.entity';
import { CarModel } from '../src/modules/vehicle/entities/car-model.entity';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';

describe('Vehicle (e2e)', () => {
  let app: INestApplication;
  let brandRepo: Repository<CarBrand>;
  let seriesRepo: Repository<CarSeries>;
  let modelRepo: Repository<CarModel>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(CarBrand))
      .useValue({
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CarSeries))
      .useValue({
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(CarModel))
      .useValue({
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
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

    brandRepo = moduleFixture.get(getRepositoryToken(CarBrand));
    seriesRepo = moduleFixture.get(getRepositoryToken(CarSeries));
    modelRepo = moduleFixture.get(getRepositoryToken(CarModel));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/vehicles/brands', () => {
    it('should return brands (public)', async () => {
      const brands = [
        { id: 2, name: 'BMW', logo: null, sort_order: 5 },
        { id: 1, name: 'Benz', logo: null, sort_order: 3 },
      ];
      (brandRepo.find as jest.Mock).mockResolvedValue(brands);

      await request(app.getHttpServer())
        .get('/api/v1/vehicles/brands')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].name).toBe('BMW');
        });
    });

    it('should return empty array when no brands exist', async () => {
      (brandRepo.find as jest.Mock).mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/vehicles/brands')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.data).toHaveLength(0);
        });
    });
  });

  describe('GET /api/v1/vehicles/series', () => {
    it('should return series for given brandId', async () => {
      (seriesRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, name: '3系', brand_id: 1, year_start: 2019, year_end: 2024 },
      ]);

      await request(app.getHttpServer())
        .get('/api/v1/vehicles/series?brandId=1')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.data).toHaveLength(1);
        });
    });

    it('should return 400 when brandId is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles/series')
        .expect(400);
    });

    it('should return 400 when brandId is not a number', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles/series?brandId=abc')
        .expect(400);
    });
  });

  describe('GET /api/v1/vehicles/models', () => {
    it('should return models with model_3d_url (null handled gracefully)', async () => {
      (modelRepo.find as jest.Mock).mockResolvedValue([
        { id: 1, name: '325Li', year: 2024, body_type: 'sedan', model_3d_url: null, series_id: 1 },
      ]);

      await request(app.getHttpServer())
        .get('/api/v1/vehicles/models?seriesId=1')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
          expect(res.body.data[0].model_3d_url).toBeNull();
        });
    });

    it('should return 400 when seriesId is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/vehicles/models')
        .expect(400);
    });
  });

  describe('GET /api/v1/vehicles/models/:id', () => {
    it('should return a single model by id', async () => {
      (modelRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: '325Li',
        year: 2024,
        body_type: 'sedan',
      });

      await request(app.getHttpServer())
        .get('/api/v1/vehicles/models/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(0);
        });
    });
  });
});
