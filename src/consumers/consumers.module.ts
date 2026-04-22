import { Module } from '@nestjs/common';
import { RabbitmqModule } from '@/rabbitmq/rabbitmq.module';
import { LogModule } from '@/log/log.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { SpecialistsModule } from '@/specialists/specialists.module';
import { ServicesModule } from '@/services/services.module';
import { StorageEventConsumer } from './storage-event.consumer';
import { OrganizationEventConsumer } from './organization-event.consumer';

@Module({
  imports: [
    RabbitmqModule,
    LogModule,
    PrismaModule,
    SpecialistsModule,
    ServicesModule,
  ],
  providers: [StorageEventConsumer, OrganizationEventConsumer],
})
export class ConsumersModule {}
