import { Global, Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import process from 'node:process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { IS_DEV_ENV } from '@/common/utils/is-dev.utils';
import DailyRotateFile from 'winston-daily-rotate-file';

@Global()
@Injectable()
export class LogService implements LoggerService {
  private logger: winston.Logger;
  private asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

  constructor() {
    if (IS_DEV_ENV) {
      this.logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.simple(),
        ),
        transports: [
          new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
          }),
        ],
      });
    } else {
      this.logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json(),
        ),
        transports: [
          new DailyRotateFile({
            filename: `logs/${process.env.SERVICE_NAME || 'example-service'}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // Архівувати старі файли
            maxSize: '20m', // Максимальний розмір 20MB
            maxFiles: '14d', // Зберігати логи за 14 днів
          }),
        ],
      });
    }
  }

  // Метод для виконання коду з контекстом
  runWithContext(context: { [key: string]: any }, callback: () => void) {
    const store = new Map<string, any>(Object.entries(context));
    this.asyncLocalStorage.run(store, callback);
  }

  // Отримання поточного контексту
  private getContext(): { [key: string]: any } {
    return Object.fromEntries(this.asyncLocalStorage.getStore() || new Map());
  }

  log(message: string, extra: object = {}) {
    this.logger.info(message, {
      ...this.getContext(),
      ...extra,
      level: 'info',
      service: process.env.SERVICE_NAME || 'example-service',
      timestamp: new Date().toISOString(),
    });
  }

  error(message: string, trace?: string, extra: object = {}) {
    this.logger.error(message, {
      ...this.getContext(),
      trace,
      ...extra,
      level: 'error',
      service: process.env.SERVICE_NAME || 'example-service',
      timestamp: new Date().toISOString(),
    });
  }

  warn(message: string, extra: object = {}) {
    this.logger.warn(message, {
      ...this.getContext(),
      ...extra,
      level: 'warn',
      service: process.env.SERVICE_NAME || 'example-service',
      timestamp: new Date().toISOString(),
    });
  }

  debug(message: string, extra: object = {}) {
    this.logger.debug(message, {
      ...this.getContext(),
      ...extra,
      level: 'debug',
      service: process.env.SERVICE_NAME || 'example-service',
      timestamp: new Date().toISOString(),
    });
  }
}
