import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { OrgServiceClientModule } from '@/clients/org-service-client.module';

@Module({
  imports: [PrismaModule, OrgServiceClientModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
