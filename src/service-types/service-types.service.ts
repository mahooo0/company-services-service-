import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto';
import { ServiceTypeStatus } from 'prisma/__generated__';

@Injectable()
export class ServiceTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  // Получить все активные типы (для пользователей)
  async findAllActive() {
    return this.prisma.serviceType.findMany({
      where: { status: ServiceTypeStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  // Получить все типы (для админа)
  async findAll() {
    return this.prisma.serviceType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить предложенные типы (для админа)
  async findPending() {
    return this.prisma.serviceType.findMany({
      where: { status: ServiceTypeStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить тип по ID
  async findOne(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!serviceType) {
      throw new NotFoundException(`Тип услуги с ID ${id} не найден`);
    }

    return serviceType;
  }

  // Создать тип (админ)
  async create(dto: CreateServiceTypeDto) {
    const existing = await this.prisma.serviceType.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Тип услуги "${dto.name}" уже существует`);
    }

    const serviceType = await this.prisma.serviceType.create({
      data: {
        name: dto.name,
        status: ServiceTypeStatus.ACTIVE,
      },
    });

    this.logger.log(`Создан тип услуги: ${serviceType.name}`);
    return serviceType;
  }

  // Предложить тип (пользователь)
  async suggest(dto: CreateServiceTypeDto, userId?: string) {
    const existing = await this.prisma.serviceType.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Тип услуги "${dto.name}" уже существует`);
    }

    const serviceType = await this.prisma.serviceType.create({
      data: {
        name: dto.name,
        status: ServiceTypeStatus.PENDING,
        suggestedByUserId: userId,
      },
    });

    this.logger.log(`Предложен тип услуги: ${serviceType.name}`);
    return serviceType;
  }

  // Обновить тип (админ)
  async update(id: string, dto: UpdateServiceTypeDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.serviceType.findFirst({
        where: {
          name: dto.name,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`Тип услуги "${dto.name}" уже существует`);
      }
    }

    const serviceType = await this.prisma.serviceType.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Обновлен тип услуги: ${serviceType.name}`);
    return serviceType;
  }

  // Принять предложенный тип (админ)
  async approve(id: string) {
    const serviceType = await this.findOne(id);

    if (serviceType.status !== ServiceTypeStatus.PENDING) {
      throw new ConflictException('Этот тип не находится на рассмотрении');
    }

    const updated = await this.prisma.serviceType.update({
      where: { id },
      data: { status: ServiceTypeStatus.ACTIVE },
    });

    this.logger.log(`Принят тип услуги: ${updated.name}`);
    return updated;
  }

  // Отклонить предложенный тип (админ)
  async reject(id: string) {
    const serviceType = await this.findOne(id);

    if (serviceType.status !== ServiceTypeStatus.PENDING) {
      throw new ConflictException('Этот тип не находится на рассмотрении');
    }

    const updated = await this.prisma.serviceType.update({
      where: { id },
      data: { status: ServiceTypeStatus.REJECTED },
    });

    this.logger.log(`Отклонен тип услуги: ${updated.name}`);
    return updated;
  }

  // Удалить тип (админ)
  async remove(id: string) {
    await this.findOne(id);

    // Проверяем, есть ли услуги с этим типом
    const servicesCount = await this.prisma.service.count({
      where: { typeId: id },
    });

    if (servicesCount > 0) {
      throw new ConflictException(
        `Невозможно удалить тип: существует ${servicesCount} услуг с этим типом`,
      );
    }

    await this.prisma.serviceType.delete({
      where: { id },
    });

    this.logger.log(`Удален тип услуги с ID: ${id}`);
  }
}
