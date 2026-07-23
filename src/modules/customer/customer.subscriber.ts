import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomerService } from './customer.service';

interface AppointmentConfirmedEvent {
  store_id: number;
  customer_name: string;
  customer_phone: string;
}

interface QuoteConfirmedEvent {
  store_id: number;
  customer_name: string;
  customer_phone: string;
}

@Injectable()
export class CustomerSubscriber {
  private readonly logger = new Logger(CustomerSubscriber.name);

  constructor(private readonly customerService: CustomerService) {}

  @OnEvent('appointment.confirmed')
  async handleAppointmentConfirmed(event: AppointmentConfirmedEvent): Promise<void> {
    try {
      await this.customerService.upsertByPhone(event.store_id, event.customer_phone, {
        name: event.customer_name,
        source: 'appointment',
      });
    } catch (error) {
      this.logger.error(
        `Failed to upsert customer from appointment: store=${event.store_id} phone=${event.customer_phone}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('quote.confirmed')
  async handleQuoteConfirmed(event: QuoteConfirmedEvent): Promise<void> {
    try {
      await this.customerService.upsertByPhone(event.store_id, event.customer_phone, {
        name: event.customer_name,
        source: 'quote',
      });
    } catch (error) {
      this.logger.error(
        `Failed to upsert customer from quote: store=${event.store_id} phone=${event.customer_phone}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
