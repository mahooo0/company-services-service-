import { Module } from '@nestjs/common';
import {
  ServicesController,
  OrganizationServicesController,
  BranchServicesController,
} from './services.controller';
import { ServicesService } from './services.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogModule } from '@/log/log.module';

@Module({
  imports: [PrismaModule, LogModule],
  controllers: [
    ServicesController,
    OrganizationServicesController,
    BranchServicesController,
  ],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
