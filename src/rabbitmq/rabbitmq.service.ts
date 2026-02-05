import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ChannelModel } from 'amqplib';
import { LogService } from '@/log/log.service';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: ChannelModel;
  private channel: amqp.Channel;

  // Конфігурація підключення
  private readonly rabbitmqUrl =
    process.env.RABBITMQ_URL || 'amqp://localhost:5672';

  constructor(private readonly logger: LogService) {}

  async onModuleInit() {
    try {
      // Встановлення з'єднання
      this.connection = await amqp.connect(this.rabbitmqUrl);

      // Створення каналу
      this.channel = await this.connection.createChannel();

      this.logger.log('Успішно підключено до RabbitMQ');
    } catch (error) {
      this.logger.error('Помилка підключення до RabbitMQ:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    // Закриття з'єднання при завершенні роботи додатку
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log("З'єднання з RabbitMQ закрито");
    } catch (error) {
      this.logger.error("Помилка при закритті з'єднання з RabbitMQ:", error);
    }
  }

  // // Метод для публікації повідомлень
  // async publish(exchange: string, routingKey: string, content: any, options?: amqp.Options.Publish) {
  //     try {
  //         // Переконуємося, що обмін існує
  //         await this.channel.assertExchange(exchange, 'topic', { durable: true });
  //
  //         // Публікуємо повідомлення
  //         return this.channel.publish(
  //             exchange,
  //             routingKey,
  //             Buffer.from(JSON.stringify(content)),
  //             options
  //         );
  //     } catch (error) {
  //         console.error('Помилка публікації повідомлення:', error);
  //         throw error;
  //     }
  // }
  //
  // // Метод для підписки на повідомлення
  // async subscribe(queue: string, callback: (msg: amqp.ConsumeMessage) => void, options?: amqp.Options.Consume) {
  //     try {
  //         // Переконуємося, що черга існує
  //         await this.channel.assertQueue(queue, { durable: true });
  //
  //         // Підписуємося на повідомлення
  //         return this.channel.consume(
  //             queue,
  //             (msg) => {
  //                 if (msg) {
  //                     callback(msg);
  //                 }
  //             },
  //             { ...options, noAck: false }
  //         );
  //     } catch (error) {
  //         console.error('Помилка підписки на чергу:', error);
  //         throw error;
  //     }
  // }
  //
  // // Метод для підтвердження обробки повідомлення
  // async ack(msg: amqp.ConsumeMessage) {
  //     this.channel.ack(msg);
  // }
  //
  // // Метод для створення прив'язки між чергою та обміном
  // async bindQueue(queue: string, exchange: string, pattern: string) {
  //     await this.channel.assertQueue(queue, { durable: true });
  //     await this.channel.assertExchange(exchange, 'topic', { durable: true });
  //     await this.channel.bindQueue(queue, exchange, pattern);
  // }
  //
  // // Отримати канал для більш складних операцій
  // getChannel(): amqp.Channel {
  //     return this.channel;
  // }
}
