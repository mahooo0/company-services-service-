import { Module } from '@nestjs/common';
import { EventPublisherService } from './event-publisher.service';
import { RabbitmqModule } from '@/rabbitmq/rabbitmq.module';
import { LogModule } from '@/log/log.module';

@Module({
  imports: [RabbitmqModule, LogModule],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class EventsModule {}
