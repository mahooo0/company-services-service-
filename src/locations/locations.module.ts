import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogModule } from '@/log/log.module';

@Module({
  imports: [PrismaModule, LogModule],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
