import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsulService } from './consul/consul.service';
import { LogService } from '@/log/log.service';
import { GlobalExceptionFilter } from '@/common/filters/exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Налаштування Swagger
  const configDocumentation = new DocumentBuilder()
    .setTitle(`${process.env.SERVICE_NAME} API`)
    .setDescription(`API documentation for ${process.env.SERVICE_NAME}`)
    .setVersion('1.0')
    .addTag('example')
    .build();

  const document = SwaggerModule.createDocument(app, configDocumentation);
  SwaggerModule.setup('api-docs', app, document);

  const log = app.get(LogService);
  app.useGlobalFilters(new GlobalExceptionFilter(log));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const server = await app.listen(process.env.SERVICE_PORT ?? 3000);

  const port = server.address().port;

  const consulService = app.get(ConsulService);
  consulService.servicePort = port;

  // Додавання метаданих Swagger до реєстрації сервісу
  consulService.registerService(port, {
    hasSwagger: 'true',
    swaggerPath: 'api-docs-json',
  });

  log.log(`Application started on port: ${port}`);

  const shutdown = async () => {
    if (consulService && consulService.deregisterService) {
      await consulService.deregisterService();
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

bootstrap();
