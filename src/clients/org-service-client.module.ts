import { Module } from '@nestjs/common';
import { OrgServiceClient } from './org-service-client.service';

@Module({
  providers: [OrgServiceClient],
  exports: [OrgServiceClient],
})
export class OrgServiceClientModule {}
