import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceFiltersDto,
  ServiceResponseDto,
} from './dto';
import { Decimal } from 'prisma/__generated__/runtime/library';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  // Преобразование в DTO ответа
  private toResponseDto(service: any): ServiceResponseDto {
    return {
      id: service.id,
      organizationId: service.organizationId,
      branchId: service.branchId,
      name: service.name,
      description: service.description,
      type: {
        id: service.type.id,
        name: service.type.name,
      },
      price: service.price ? Number(service.price) : null,
      imageId: service.imageId,
      isActive: service.isActive,
      variations: service.variations.map((v: any) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        isActive: v.isActive,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  // Получить услуги с фильтрацией и пагинацией
  async findAll(filters: ServiceFiltersDto) {
    const { organizationId, branchId, typeId, isActive, page, limit } = filters;

    const where: any = {};

    if (organizationId) where.organizationId = organizationId;
    if (branchId) where.branchId = branchId;
    if (typeId) where.typeId = typeId;
    if (isActive !== undefined) where.isActive = isActive;

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          type: true,
          variations: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page! - 1) * limit!,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit!);

    return {
      data: services.map((s) => this.toResponseDto(s)),
      total,
      page: page!,
      limit: limit!,
      totalPages,
      hasNextPage: page! < totalPages,
      hasPreviousPage: page! > 1,
    };
  }

  // Получить услугу по ID
  async findOne(id: string): Promise<ServiceResponseDto> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        type: true,
        variations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Услуга с ID ${id} не найдена`);
    }

    return this.toResponseDto(service);
  }

  // Создать услугу
  async create(dto: CreateServiceDto): Promise<ServiceResponseDto> {
    // Проверяем, что тип услуги существует и активен
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: dto.typeId },
    });

    if (!serviceType) {
      throw new NotFoundException(`Тип услуги с ID ${dto.typeId} не найден`);
    }

    if (serviceType.status !== 'ACTIVE') {
      throw new BadRequestException('Выбранный тип услуги не активен');
    }

    // Валидация: если есть вариации - цена должна быть на них, если нет - на услуге
    if (dto.variations && dto.variations.length > 0 && dto.price) {
      throw new BadRequestException(
        'Нельзя указать цену на услуге, если есть вариации',
      );
    }

    if (!dto.variations?.length && !dto.price) {
      throw new BadRequestException(
        'Укажите цену услуги или добавьте вариации с ценами',
      );
    }

    const service = await this.prisma.service.create({
      data: {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
        typeId: dto.typeId,
        price: dto.price ? new Decimal(dto.price) : null,
        imageId: dto.imageId,
        variations: dto.variations
          ? {
              create: dto.variations.map((v) => ({
                name: v.name,
                price: new Decimal(v.price),
              })),
            }
          : undefined,
      },
      include: {
        type: true,
        variations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.logger.log(`Создана услуга: ${service.name} (${service.id})`);
    return this.toResponseDto(service);
  }

  // Обновить услугу
  async update(id: string, dto: UpdateServiceDto): Promise<ServiceResponseDto> {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      include: { variations: true },
    });

    if (!existing) {
      throw new NotFoundException(`Услуга с ID ${id} не найдена`);
    }

    // Проверяем тип если он обновляется
    if (dto.typeId) {
      const serviceType = await this.prisma.serviceType.findUnique({
        where: { id: dto.typeId },
      });

      if (!serviceType) {
        throw new NotFoundException(`Тип услуги с ID ${dto.typeId} не найден`);
      }

      if (serviceType.status !== 'ACTIVE') {
        throw new BadRequestException('Выбранный тип услуги не активен');
      }
    }

    // Удаляем вариации если указаны ID для удаления
    if (dto.deleteVariationIds?.length) {
      await this.prisma.serviceVariation.deleteMany({
        where: {
          id: { in: dto.deleteVariationIds },
          serviceId: id,
        },
      });
    }

    // Обновляем/создаем вариации
    if (dto.variations?.length) {
      for (const variation of dto.variations) {
        if (variation.id) {
          // Обновляем существующую
          await this.prisma.serviceVariation.update({
            where: { id: variation.id },
            data: {
              name: variation.name,
              price: variation.price ? new Decimal(variation.price) : undefined,
              isActive: variation.isActive,
            },
          });
        } else {
          // Создаем новую
          await this.prisma.serviceVariation.create({
            data: {
              serviceId: id,
              name: variation.name!,
              price: new Decimal(variation.price!),
            },
          });
        }
      }
    }

    // Обновляем основную услугу
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
        typeId: dto.typeId,
        price: dto.price !== undefined ? (dto.price ? new Decimal(dto.price) : null) : undefined,
        imageId: dto.imageId,
        isActive: dto.isActive,
      },
      include: {
        type: true,
        variations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.logger.log(`Обновлена услуга: ${service.name} (${service.id})`);
    return this.toResponseDto(service);
  }

  // Удалить услугу
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Услуга с ID ${id} не найдена`);
    }

    await this.prisma.service.delete({
      where: { id },
    });

    this.logger.log(`Удалена услуга: ${existing.name} (${id})`);
  }

  // Получить услуги по организации
  async findByOrganization(organizationId: string, filters: ServiceFiltersDto) {
    return this.findAll({ ...filters, organizationId });
  }

  // Получить услуги по филиалу
  async findByBranch(branchId: string, filters: ServiceFiltersDto) {
    return this.findAll({ ...filters, branchId });
  }
}
