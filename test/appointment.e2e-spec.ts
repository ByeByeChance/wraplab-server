import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../src/modules/staff/entities/staff.entity';
import { Store } from '../src/modules/store/entities/store.entity';
import { Appointment } from '../src/modules/appointment/entities/appointment.entity';
import { AppointmentWaitlist } from '../src/modules/appointment/entities/appointment-waitlist.entity';
import { ServiceTypeConfig } from '../src/modules/appointment/entities/service-type-config.entity';
import { StoreServiceConfig } from '../src/modules/appointment/entities/store-service-config.entity';
import { JwtService } from '@nestjs/jwt';

describe('Appointment (e2e)', () => {
  let app: INestApplication;
  let staffRepo: Repository<Staff>;
  let storeRepo: Repository<Store>;
  let appointmentRepo: Repository<Appointment>;
  let waitlistRepo: Repository<AppointmentWaitlist>;
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
      .overrideProvider(getRepositoryToken(Appointment))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(AppointmentWaitlist))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
          getMany: jest.fn().mockResolvedValue([]),
        }),
        manager: {
          transaction: jest.fn().mockImplementation((cb: any) => cb({
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue({ affected: 1 }),
            }),
          })),
        },
      })
      .overrideProvider(getRepositoryToken(ServiceTypeConfig))
      .useValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(StoreServiceConfig))
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
    appointmentRepo = moduleFixture.get(getRepositoryToken(Appointment));
    waitlistRepo = moduleFixture.get(getRepositoryToken(AppointmentWaitlist));
    jwtService = moduleFixture.get(JwtService);

    validToken = jwtService.sign(
      {
        sub: 1,
        store_id: 1,
        role: 'staff',
        phone: '13800138000',
        token_version: 0,
        jti: 'appt-jti',
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

  describe('POST /api/v1/appointments (public)', () => {
    it('should return 400 when required fields (store_id) are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .send({})
        .expect(400);
    });

    it('should return 400 when appointment_date is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .send({
          store_id: 1,
          customer_name: 'Test Customer',
          customer_phone: '13800138000',
          service_type: 'INSTALLATION',
        })
        .expect(400);
    });

    it('should return 400 when time_slot is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments')
        .send({
          store_id: 1,
          customer_name: 'Test Customer',
          customer_phone: '13800138000',
          service_type: 'INSTALLATION',
          appointment_date: '2026-08-01',
          time_slot: 'MIDNIGHT',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/appointments/slots (public)', () => {
    it('should return 400 when store_id is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/appointments/slots')
        .expect(400);
    });
  });

  describe('GET /api/v1/appointments/mine', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/appointments/mine')
        .expect(401);
    });
  });

  describe('POST /api/v1/appointments/waitlist (public)', () => {
    it('should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments/waitlist')
        .send({})
        .expect(400);
    });

    it('should return 400 for invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments/waitlist')
        .send({
          store_id: 1,
          appointment_date: '2026-08-01',
          time_slot_id: 1,
          customer_name: 'Test',
          customer_phone: '12345',
          service_type: 'full_wrap',
        })
        .expect(400);
    });

    it('should return 400 when service_type is invalid enum', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/appointments/waitlist')
        .send({
          store_id: 1,
          appointment_date: '2026-08-01',
          time_slot_id: 1,
          customer_name: 'Test',
          customer_phone: '13800138000',
          service_type: 'invalid_type',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/appointments/waitlist/status (public)', () => {
    it('should return 200 even without phone (no DTO validation on Query param)', async () => {
      (waitlistRepo.findOne as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/appointments/waitlist/status')
        .expect(200);
    });

    it('should accept valid phone query param', async () => {
      (waitlistRepo.findOne as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/appointments/waitlist/status?phone=13800138000')
        .expect(200);
    });
  });

  describe('DELETE /api/v1/appointments/waitlist/:id', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/appointments/waitlist/1')
        .expect(401);
    });

    it('should accept authenticated request', async () => {
      mockStaffAuth();
      (waitlistRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        store_id: 1,
        status: 'waiting',
      });
      (waitlistRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await request(app.getHttpServer())
        .delete('/api/v1/appointments/waitlist/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });
});
