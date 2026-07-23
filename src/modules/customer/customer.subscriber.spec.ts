import { Test, TestingModule } from '@nestjs/testing';
import { CustomerSubscriber } from './customer.subscriber';
import { CustomerService } from './customer.service';

describe('CustomerSubscriber', () => {
  let subscriber: CustomerSubscriber;
  let customerService: CustomerService;

  const mockCustomerService = {
    upsertByPhone: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerSubscriber, { provide: CustomerService, useValue: mockCustomerService }],
    }).compile();

    subscriber = module.get<CustomerSubscriber>(CustomerSubscriber);
    customerService = module.get<CustomerService>(CustomerService);
  });

  describe('handleAppointmentConfirmed', () => {
    it('should call upsertByPhone on appointment.confirmed', async () => {
      const event = {
        store_id: 1,
        customer_name: 'Test',
        customer_phone: '13800138000',
      };

      await subscriber.handleAppointmentConfirmed(event);

      expect(customerService.upsertByPhone).toHaveBeenCalledWith(1, '13800138000', {
        name: 'Test',
        source: 'appointment',
      });
    });

    it('should silently ignore errors', async () => {
      mockCustomerService.upsertByPhone.mockRejectedValue(new Error('DB error'));

      await expect(
        subscriber.handleAppointmentConfirmed({
          store_id: 1,
          customer_name: 'Test',
          customer_phone: '13800138000',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleQuoteConfirmed', () => {
    it('should call upsertByPhone on quote.confirmed', async () => {
      const event = {
        store_id: 2,
        customer_name: 'Bob',
        customer_phone: '13900139000',
      };

      await subscriber.handleQuoteConfirmed(event);

      expect(customerService.upsertByPhone).toHaveBeenCalledWith(2, '13900139000', { name: 'Bob', source: 'quote' });
    });
  });
});
