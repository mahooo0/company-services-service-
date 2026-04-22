import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '@/rabbitmq/rabbitmq.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';

interface OrganizationEvent {
  id: string;
  name: string;
  slug?: string;
  category?: string;
  description?: string;
  avatar?: string;
  averageRating?: number;
  reviewCount?: number;
  isActive?: boolean;
}

interface AddressEvent {
  id: string;
  organizationId: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  lat: number;
  lon: number;
  workTime?: any;
}

@Injectable()
export class OrganizationEventConsumer implements OnModuleInit {
  private readonly ORG_QUEUE = 'company-services.organization-events';
  private readonly ORG_EXCHANGE = 'organization';
  private readonly ADDR_QUEUE = 'company-services.address-events';
  private readonly ADDR_EXCHANGE = 'organization.address';

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  async onModuleInit() {
    try {
      await this.rabbitmqService.subscribeFanoutExchange(
        this.ORG_EXCHANGE,
        this.ORG_QUEUE,
        this.handleOrgMessage.bind(this),
      );
      this.logger.log(
        `OrganizationEventConsumer: Subscribed to ${this.ORG_EXCHANGE} exchange`,
      );

      await this.rabbitmqService.subscribeFanoutExchange(
        this.ADDR_EXCHANGE,
        this.ADDR_QUEUE,
        this.handleAddressMessage.bind(this),
      );
      this.logger.log(
        `OrganizationEventConsumer: Subscribed to ${this.ADDR_EXCHANGE} exchange`,
      );
    } catch (error) {
      this.logger.error(
        'OrganizationEventConsumer: Failed to subscribe',
        error,
      );
    }
  }

  private async handleOrgMessage(msg: any) {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const routingKey = msg.fields?.routingKey || '';
      const data: OrganizationEvent = content.data || content;

      this.logger.log(
        `OrganizationEventConsumer: Processing ${routingKey} for org ${data.id}`,
      );

      switch (routingKey) {
        case 'organization.created':
        case 'organization.updated':
          await this.upsertOrganization(data);
          break;
        case 'organization.deleted':
          await this.deleteOrganization(data.id);
          break;
        default:
          this.logger.log(
            `OrganizationEventConsumer: Unknown routing key: ${routingKey}`,
          );
      }

      this.rabbitmqService.getChannel().ack(msg);
    } catch (error) {
      this.logger.error(
        'OrganizationEventConsumer: Error processing org message',
        error,
      );

      const isPermanent = error instanceof SyntaxError;
      this.rabbitmqService.getChannel().nack(msg, false, !isPermanent);
    }
  }

  private async handleAddressMessage(msg: any) {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      const routingKey = msg.fields?.routingKey || '';
      const data: AddressEvent = content.data || content;

      this.logger.log(
        `OrganizationEventConsumer: Processing ${routingKey} for address ${data.id}`,
      );

      switch (routingKey) {
        case 'address.created':
        case 'address.updated':
          await this.upsertAddress(data);
          break;
        case 'address.deleted':
          await this.deleteAddress(data.id);
          break;
        default:
          this.logger.log(
            `OrganizationEventConsumer: Unknown address routing key: ${routingKey}`,
          );
      }

      this.rabbitmqService.getChannel().ack(msg);
    } catch (error) {
      this.logger.error(
        'OrganizationEventConsumer: Error processing address message',
        error,
      );

      const isPermanent = error instanceof SyntaxError;
      this.rabbitmqService.getChannel().nack(msg, false, !isPermanent);
    }
  }

  private async upsertOrganization(data: OrganizationEvent) {
    await this.prisma.organization.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        category: data.category,
        description: data.description,
        avatar: data.avatar,
        averageRating: data.averageRating ?? 0,
        reviewCount: data.reviewCount ?? 0,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        slug: data.slug,
        category: data.category,
        description: data.description,
        avatar: data.avatar,
        averageRating: data.averageRating ?? undefined,
        reviewCount: data.reviewCount ?? undefined,
        isActive: data.isActive ?? undefined,
      },
    });
  }

  private async deleteOrganization(id: string) {
    await this.prisma.organization.delete({ where: { id } }).catch(() => {});
  }

  private async upsertAddress(data: AddressEvent) {
    await this.prisma.organizationAddress.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        name: data.name,
        city: data.city,
        state: data.state,
        country: data.country,
        address: data.address,
        lat: data.lat,
        lon: data.lon,
        workTime: data.workTime ?? undefined,
      },
      update: {
        name: data.name,
        city: data.city,
        state: data.state,
        country: data.country,
        address: data.address,
        lat: data.lat,
        lon: data.lon,
        workTime: data.workTime ?? undefined,
      },
    });
  }

  private async deleteAddress(id: string) {
    await this.prisma.organizationAddress
      .delete({ where: { id } })
      .catch(() => {});
  }
}
