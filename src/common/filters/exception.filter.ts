// exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LogService } from '@/log/log.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      message:
        exception instanceof Error ? exception.message : String(exception),
      error: HttpStatus[status],
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Логування помилки з повною інформацією
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : 'Unknown error',
      {
        exception:
          exception instanceof Error ? exception.message : String(exception),
        statusCode: status,
      },
    );

    response.status(status).json(errorResponse);
  }
}
