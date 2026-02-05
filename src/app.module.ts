import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsulModule } from './consul/consul.module';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { LogModule } from './log/log.module';
import { LoggerMiddleware } from '@/log/middlewares/logger.middleware';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConsulModule,
    HealthModule,
    PrismaModule,
    RabbitmqModule,
    LogModule,
    ServiceCategoriesModule,
    ServiceTypesModule,
    ServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: '/health', method: RequestMethod.ALL })
      .forRoutes('*');
    //.forRoutes(SomeController); // Застосовуємо лише до SomeController
    // АБО
    // .forRoutes({ path: 'api/*', method: RequestMethod.ALL }); // Застосовуємо до всіх маршрутів, що починаються з /api
  }
}
