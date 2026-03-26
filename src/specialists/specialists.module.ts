import { Module } from '@nestjs/common';
import {
  SpecialistsController,
  OrganizationSpecialistsController,
  LocationSpecialistsController,
} from './specialists.controller';
import { SpecialistsService } from './specialists.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogModule } from '@/log/log.module';
import { EventsModule } from '@/events/events.module';

@Module({
  imports: [PrismaModule, LogModule, EventsModule],
  controllers: [
    SpecialistsController,
    OrganizationSpecialistsController,
    LocationSpecialistsController,
  ],
  providers: [SpecialistsService],
  exports: [SpecialistsService],
})
export class SpecialistsModule {}
