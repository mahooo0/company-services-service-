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
  async findAllActive(categoryId?: string) {
    const where: any = { status: ServiceTypeStatus.ACTIVE };
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.serviceType.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  // Получить все типы (для админа)
  async findAll(categoryId?: string) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.serviceType.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить предложенные типы (для админа)
  async findPending() {
    return this.prisma.serviceType.findMany({
      where: { status: ServiceTypeStatus.PENDING },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить тип по ID
  async findOne(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!serviceType) {
      throw new NotFoundException(`Тип услуги с ID ${id} не найден`);
    }

    return serviceType;
  }

  // Получить тип по slug
  async findBySlug(slug: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!serviceType) {
      throw new NotFoundException(`Тип услуги со slug "${slug}" не найден`);
    }

    return serviceType;
  }

  // Создать тип (админ)
  async create(dto: CreateServiceTypeDto) {
    // Проверяем существование категории
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Категория с ID ${dto.categoryId} не найдена`,
      );
    }

    // Проверяем уникальность slug
    const existingBySlug = await this.prisma.serviceType.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException(`Slug "${dto.slug}" уже используется`);
    }

    // Проверяем уникальность name в категории
    const existingByName = await this.prisma.serviceType.findFirst({
      where: {
        name: dto.name,
        categoryId: dto.categoryId,
      },
    });

    if (existingByName) {
      throw new ConflictException(
        `Тип услуги "${dto.name}" уже существует в этой категории`,
      );
    }

    const serviceType = await this.prisma.serviceType.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        categoryId: dto.categoryId,
        status: ServiceTypeStatus.ACTIVE,
      },
      include: { category: true },
    });

    this.logger.log(`Создан тип услуги: ${serviceType.name}`);
    return serviceType;
  }

  // Предложить тип (пользователь)
  async suggest(dto: CreateServiceTypeDto, userId?: string) {
    // Проверяем существование категории
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Категория с ID ${dto.categoryId} не найдена`,
      );
    }

    // Проверяем уникальность slug
    const existingBySlug = await this.prisma.serviceType.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException(`Slug "${dto.slug}" уже используется`);
    }

    const serviceType = await this.prisma.serviceType.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        categoryId: dto.categoryId,
        status: ServiceTypeStatus.PENDING,
        suggestedByUserId: userId,
      },
      include: { category: true },
    });

    this.logger.log(`Предложен тип услуги: ${serviceType.name}`);
    return serviceType;
  }

  // Обновить тип (админ)
  async update(id: string, dto: UpdateServiceTypeDto) {
    const existing = await this.findOne(id);

    // Проверяем slug если обновляется
    if (dto.slug && dto.slug !== existing.slug) {
      const existingBySlug = await this.prisma.serviceType.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });

      if (existingBySlug) {
        throw new ConflictException(`Slug "${dto.slug}" уже используется`);
      }
    }

    // Проверяем name в категории если обновляется
    if (dto.name) {
      const categoryId = dto.categoryId || existing.categoryId;
      const existingByName = await this.prisma.serviceType.findFirst({
        where: {
          name: dto.name,
          categoryId,
          NOT: { id },
        },
      });

      if (existingByName) {
        throw new ConflictException(
          `Тип услуги "${dto.name}" уже существует в этой категории`,
        );
      }
    }

    const serviceType = await this.prisma.serviceType.update({
      where: { id },
      data: dto,
      include: { category: true },
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
      include: { category: true },
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
      include: { category: true },
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
