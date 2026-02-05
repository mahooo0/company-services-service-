import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LogService } from '@/log/log.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LogService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const accountId = req.headers['x-account-id'] || '';
    const userId = req.headers['x-user-id'] || '';
    const startTime = Date.now();

    // Контекст для запиту
    const context = {
      requestId,
      userId,
      accountId,
      method: req.method,
      endpoint: req.originalUrl,
      clientIp: req.ip,
    };

    // Виконуємо весь ланцюжок обробки запиту в контексті
    this.logger.runWithContext(context, () => {
      // Логуємо початок запиту
      const safeBody = this.sanitizeRequestBody(req.body);
      this.logger.log('Request started', { payload: safeBody });

      // Обробка завершення запиту
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logger.log('Request completed', {
          statusCode: res.statusCode,
          responseTime,
        });
      });

      next();
    });
  }

  // Метод для обробки тіла запиту
  private sanitizeRequestBody(body: any): any {
    if (!body) return {};

    // Обмеження розміру та маскування чутливих полів
    const sanitized = { ...body };

    // Маскування паролів та токенів
    if (sanitized.password) sanitized.password = '******';
    if (sanitized.passwordRepeat) sanitized.passwordRepeat = '******';
    if (sanitized.token) sanitized.token = '******';

    // Серіалізація з обмеженням розміру
    const stringified = JSON.stringify(sanitized);
    return stringified.length > 1000
      ? { truncated: true, preview: stringified.substring(0, 1000) + '...' }
      : sanitized;
  }
}
