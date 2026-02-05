import { Module } from '@nestjs/common';
import { ServiceTypesController } from './service-types.controller';
import { ServiceTypesService } from './service-types.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogModule } from '@/log/log.module';

@Module({
  imports: [PrismaModule, LogModule],
  controllers: [ServiceTypesController],
  providers: [ServiceTypesService],
  exports: [ServiceTypesService],
})
export class ServiceTypesModule {}
