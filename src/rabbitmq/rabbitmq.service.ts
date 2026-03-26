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
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log("З'єднання з RabbitMQ закрито");
    } catch (error) {
      this.logger.error("Помилка при закритті з'єднання з RabbitMQ:", error);
    }
  }

  /**
   * Subscribe to fanout exchange
   */
  async subscribeFanoutExchange(
    exchange: string,
    queueName: string,
    callback: (msg: amqp.ConsumeMessage | null) => void,
    options?: amqp.Options.Consume,
  ) {
    try {
      await this.channel.assertExchange(exchange, 'fanout', { durable: true });
      const q = await this.channel.assertQueue(queueName, { durable: true });
      await this.channel.bindQueue(q.queue, exchange, '');

      return this.channel.consume(q.queue, callback, {
        ...options,
        noAck: false,
      });
    } catch (error) {
      this.logger.error('Error subscribing to fanout exchange:', error);
      throw error;
    }
  }

  /**
   * Publish message to fanout exchange
   */
  async publishFanoutExchange(
    exchange: string,
    routingKey: string,
    data: any,
  ): Promise<void> {
    try {
      await this.channel.assertExchange(exchange, 'fanout', { durable: true });

      const message = Buffer.from(
        JSON.stringify({
          event: routingKey,
          data,
          timestamp: new Date().toISOString(),
        }),
      );

      this.channel.publish(exchange, routingKey, message, {
        persistent: true,
        contentType: 'application/json',
      });

      this.logger.log(`Published event ${routingKey} to exchange ${exchange}`);
    } catch (error) {
      this.logger.error(`Error publishing to exchange ${exchange}:`, error);
      throw error;
    }
  }

  /**
   * Get channel for advanced operations (ack/nack)
   */
  getChannel(): amqp.Channel {
    return this.channel;
  }
}
