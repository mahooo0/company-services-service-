import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller('health')
@ApiExcludeController()
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  checkHealth() {
    return this.health.check([]);
  }
}
