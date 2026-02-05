import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Consul from 'consul';
import { RegisterOptions } from 'consul/lib/agent/service';
import * as process from 'node:process';

@Injectable()
export class ConsulService implements OnModuleDestroy {
  private readonly consul: Consul;
  private readonly logger = new Logger(ConsulService.name);
  private serviceId: string;
  private readonly serviceName =
    process.env.SERVICE_NAME || 'company-services-service';
  private _servicePort = Number(process.env.SERVICE_PORT) || 0;

  constructor() {
    this.serviceId =
      process.env.SERVICE_ID ||
      `${this.serviceName}:${Math.random().toString(36).substring(2, 10)}`;

    // Конфігурація для підключення до Consul з токеном
    const consulConfig: any = {
      host: process.env.CONSUL_HOST || 'localhost',
      secure: process.env.CONSUL_SECURE === 'true',
    };

    // Додаємо токен, якщо він є
    if (process.env.CONSUL_TOKEN) {
      consulConfig.defaults = {
        token: process.env.CONSUL_TOKEN,
      };
    }

    // Додаємо порт тільки якщо він вказаний
    if (process.env.CONSUL_PORT) {
      consulConfig.port = Number(process.env.CONSUL_PORT);
    }

    this.consul = new Consul(consulConfig);
  }

  // async onModuleInit() {
  //   await this.registerService();
  // }

  async onModuleDestroy() {
    await this.deregisterService();
  }

  async registerService(
    port: number,
    metadata?: { hasSwagger?: string; swaggerPath?: string },
  ) {
    const serviceDef = {
      id: this.serviceId,
      name: this.serviceName,
      address: process.env.SERVICE_HOST || 'localhost',
      port: this._servicePort,
      meta: metadata || {},
      check: {
        http: `http://${process.env.HEALTH_CHECK_HOST || 'localhost'}:${port}/health`,
        interval: '10s',
        timeout: '5s',
        deregistercriticalserviceafter: '1m',
      },
    } as RegisterOptions;
    try {
      await this.consul.agent.service.register(serviceDef);
      this.logger.log(`Service registered in Consul: ${this.serviceName}`);
    } catch (err) {
      this.logger.error('Consul registration error', err);
    }
  }

  async deregisterService() {
    try {
      await this.consul.agent.service.deregister(this.serviceId);
      this.logger.log(`Service deregistered from Consul: ${this.serviceName}`);
    } catch (err) {
      this.logger.error('Consul deregistration error', err);
    }
  }

  async kvGet(key: string): Promise<string | null> {
    try {
      const result = await this.consul.kv.get(key);
      return result?.Value
        ? Buffer.from(result.Value, 'base64').toString()
        : null;
    } catch (err) {
      this.logger.error('Consul KV get error', err);
      return null;
    }
  }

  async kvSet(key: string, value: string): Promise<boolean> {
    try {
      await this.consul.kv.set(key, value);
      return true;
    } catch (err) {
      this.logger.error('Consul KV set error', err);
      return false;
    }
  }

  set servicePort(value: number) {
    this._servicePort = value;
  }
}
