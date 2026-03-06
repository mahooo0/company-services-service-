import { Module } from '@nestjs/common';
import { RabbitmqModule } from '@/rabbitmq/rabbitmq.module';
import { LogModule } from '@/log/log.module';
import { SpecialistsModule } from '@/specialists/specialists.module';
import { ServicesModule } from '@/services/services.module';
import { StorageEventConsumer } from './storage-event.consumer';

@Module({
  imports: [RabbitmqModule, LogModule, SpecialistsModule, ServicesModule],
  providers: [StorageEventConsumer],
})
export class ConsumersModule {}
