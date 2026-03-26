import { Injectable } from '@nestjs/common';
import { RabbitmqService } from '@/rabbitmq/rabbitmq.service';
import { LogService } from '@/log/log.service';

@Injectable()
export class EventPublisherService {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly logger: LogService,
  ) {}

  async publishServiceEvent(routingKey: string, data: any): Promise<void> {
    await this.rabbitmqService.publishFanoutExchange(
      'service',
      routingKey,
      data,
    );
  }

  async publishSpecialistEvent(routingKey: string, data: any): Promise<void> {
    await this.rabbitmqService.publishFanoutExchange(
      'specialist',
      routingKey,
      data,
    );
  }

  async publishScheduleEvent(routingKey: string, data: any): Promise<void> {
    await this.rabbitmqService.publishFanoutExchange(
      'schedule',
      routingKey,
      data,
    );
  }

  async publishVariationEvent(routingKey: string, data: any): Promise<void> {
    await this.rabbitmqService.publishFanoutExchange(
      'service-variation',
      routingKey,
      data,
    );
  }
}
