import { Controller } from '@nestjs/common';
import { ConsulService } from './consul.service';

@Controller()
export class ConsulController {
  constructor(private readonly consulService: ConsulService) {}

  //
  // @Get('kv')
  // async getKv(@Query('key') key: string) {
  //     return {value: await this.consulService.kvGet(key)};
  // }
  //
  // @Post('kv')
  // async setKv(@Body() body: { key: string; value: string }) {
  //     return {success: await this.consulService.kvSet(body.key, body.value)};
  // }
}
