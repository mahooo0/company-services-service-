import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { OrgServiceClientModule } from '@/clients/org-service-client.module';
import { LogModule } from '@/log/log.module';

@Module({
  imports: [PrismaModule, OrgServiceClientModule, LogModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
