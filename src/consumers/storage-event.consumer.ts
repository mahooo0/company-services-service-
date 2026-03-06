import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '@/rabbitmq/rabbitmq.service';
import { SpecialistsService } from '@/specialists/specialists.service';
import { ServicesService } from '@/services/services.service';
import { LogService } from '@/log/log.service';

interface FileUploadedEvent {
  accountId: string | null;
  attachmentId: string;
  path: string;
  publicUrl: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface FileDeletedEvent {
  accountId: string | null;
  attachmentId?: string;
  path: string;
  bucket: string;
  fileName: string;
  entityType: string;
  entityId: string;
}

type StorageEvent = FileUploadedEvent | FileDeletedEvent;

@Injectable()
export class StorageEventConsumer implements OnModuleInit {
  private readonly QUEUE_NAME = 'company-services.storage-events';
  private readonly EXCHANGE_NAME = 'storage';

  private readonly ENTITY_TYPES = [
    'SPECIALIST_AVATAR',
    'SERVICE_IMAGE',
  ];

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly specialistsService: SpecialistsService,
    private readonly servicesService: ServicesService,
    private readonly logger: LogService,
  ) {}

  async onModuleInit() {
    try {
      await this.rabbitmqService.subscribeFanoutExchange(
        this.EXCHANGE_NAME,
        this.QUEUE_NAME,
        this.handleMessage.bind(this),
      );
      this.logger.log(
        `StorageEventConsumer: Subscribed to ${this.EXCHANGE_NAME} exchange`,
      );
    } catch (error) {
      this.logger.error('StorageEventConsumer: Failed to subscribe', error);
    }
  }

  private async handleMessage(msg: any) {
    if (!msg) return;

    try {
      const content: StorageEvent = JSON.parse(msg.content.toString());
      const routingKey = msg.fields?.routingKey || '';

      if (!this.ENTITY_TYPES.includes(content.entityType)) {
        this.rabbitmqService.getChannel().ack(msg);
        return;
      }

      this.logger.log(
        `StorageEventConsumer: Processing ${routingKey} for ${content.entityType} (entityId=${content.entityId})`,
      );

      switch (routingKey) {
        case 'file.uploaded':
          await this.handleFileUploaded(content as FileUploadedEvent);
          break;
        case 'file.deleted':
          await this.handleFileDeleted(content as FileDeletedEvent);
          break;
        default:
          this.logger.log(
            `StorageEventConsumer: Unknown routing key: ${routingKey}`,
          );
      }

      this.rabbitmqService.getChannel().ack(msg);
    } catch (error) {
      this.logger.error(
        'StorageEventConsumer: Error processing message',
        error,
      );

      const isPermanentError = error instanceof SyntaxError;
      if (isPermanentError) {
        this.logger.error(
          'StorageEventConsumer: Permanent error, discarding message',
        );
        this.rabbitmqService.getChannel().nack(msg, false, false);
      } else {
        this.rabbitmqService.getChannel().nack(msg, false, true);
      }
    }
  }

  private async handleFileUploaded(event: FileUploadedEvent) {
    switch (event.entityType) {
      case 'SPECIALIST_AVATAR':
        this.logger.log(
          `StorageEventConsumer: Avatar uploaded for specialist ${event.entityId}`,
        );
        await this.specialistsService.updateAvatar(
          event.entityId,
          event.publicUrl,
        );
        break;

      case 'SERVICE_IMAGE':
        this.logger.log(
          `StorageEventConsumer: Image uploaded for service ${event.entityId}`,
        );
        await this.servicesService.updateImageUrl(
          event.entityId,
          event.publicUrl,
        );
        break;
    }
  }

  private async handleFileDeleted(event: FileDeletedEvent) {
    switch (event.entityType) {
      case 'SPECIALIST_AVATAR':
        this.logger.log(
          `StorageEventConsumer: Avatar deleted for specialist ${event.entityId}`,
        );
        await this.specialistsService.clearAvatar(event.entityId);
        break;

      case 'SERVICE_IMAGE':
        this.logger.log(
          `StorageEventConsumer: Image deleted for service ${event.entityId}`,
        );
        await this.servicesService.clearImageUrl(event.entityId);
        break;
    }
  }
}
