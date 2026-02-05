import { Global, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';
import { ConsulController } from './consul.controller';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  controllers: [ConsulController],
  imports: [ConfigModule],
  providers: [ConsulService],
  exports: [ConsulService],
})
export class ConsulModule {}
