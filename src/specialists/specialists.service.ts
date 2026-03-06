import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import {
  CreateSpecialistDto,
  UpdateSpecialistDto,
  SpecialistFiltersDto,
  AssignServiceDto,
  AssignLocationDto,
} from './dto';

@Injectable()
export class SpecialistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  // Получить специалистов с фильтрацией и пагинацией
  async findAll(filters: SpecialistFiltersDto) {
    const { organizationId, isTopMaster, search, page, limit } = filters;

    const where: any = {};

    if (organizationId) where.organizationId = organizationId;
    if (isTopMaster !== undefined) where.isTopMaster = isTopMaster;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [specialists, total] = await Promise.all([
      this.prisma.specialist.findMany({
        where,
        include: {
          services: {
            include: {
              service: true,
            },
          },
          locations: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page! - 1) * limit!,
        take: limit,
      }),
      this.prisma.specialist.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit!);

    return {
      data: specialists,
      total,
      page: page!,
      limit: limit!,
      totalPages,
      hasNextPage: page! < totalPages,
      hasPreviousPage: page! > 1,
    };
  }

  // Получить специалиста по ID
  async findOne(id: string) {
    const specialist = await this.prisma.specialist.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        locations: true,
        schedules: true,
      },
    });

    if (!specialist) {
      throw new NotFoundException(`Специалист с ID ${id} не найден`);
    }

    return specialist;
  }

  // Создать специалиста
  async create(dto: CreateSpecialistDto) {
    const specialist = await this.prisma.specialist.create({
      data: {
        organizationId: dto.organizationId,
        avatar: dto.avatar,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        description: dto.description,
        isTopMaster: dto.isTopMaster ?? false,
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        locations: true,
      },
    });

    this.logger.log(
      `Создан специалист: ${specialist.firstName} ${specialist.lastName} (${specialist.id})`,
    );
    return specialist;
  }

  // Обновить специалиста
  async update(id: string, dto: UpdateSpecialistDto) {
    const existing = await this.prisma.specialist.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Специалист с ID ${id} не найден`);
    }

    const specialist = await this.prisma.specialist.update({
      where: { id },
      data: {
        avatar: dto.avatar,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        description: dto.description,
        isTopMaster: dto.isTopMaster,
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        locations: true,
      },
    });

    this.logger.log(
      `Обновлен специалист: ${specialist.firstName} ${specialist.lastName} (${specialist.id})`,
    );
    return specialist;
  }

  // Удалить специалиста
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.specialist.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Специалист с ID ${id} не найден`);
    }

    await this.prisma.specialist.delete({
      where: { id },
    });

    this.logger.log(
      `Удален специалист: ${existing.firstName} ${existing.lastName} (${id})`,
    );
  }

  // Назначить услугу специалисту
  async assignService(specialistId: string, dto: AssignServiceDto) {
    // Проверяем существование специалиста
    const specialist = await this.prisma.specialist.findUnique({
      where: { id: specialistId },
    });

    if (!specialist) {
      throw new NotFoundException(
        `Специалист с ID ${specialistId} не найден`,
      );
    }

    // Проверяем существование услуги
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Услуга с ID ${dto.serviceId} не найдена`);
    }

    try {
      const specialistService = await this.prisma.specialistService.create({
        data: {
          specialistId,
          serviceId: dto.serviceId,
          organizationId: dto.organizationId,
        },
        include: {
          service: true,
        },
      });

      this.logger.log(
        `Услуга ${dto.serviceId} назначена специалисту ${specialistId}`,
      );
      return specialistService;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          'Эта услуга уже назначена данному специалисту',
        );
      }
      throw error;
    }
  }

  // Убрать услугу у специалиста
  async unassignService(
    specialistId: string,
    serviceId: string,
  ): Promise<void> {
    const record = await this.prisma.specialistService.findUnique({
      where: {
        specialistId_serviceId: {
          specialistId,
          serviceId,
        },
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Связь специалиста ${specialistId} с услугой ${serviceId} не найдена`,
      );
    }

    await this.prisma.specialistService.delete({
      where: {
        specialistId_serviceId: {
          specialistId,
          serviceId,
        },
      },
    });

    this.logger.log(
      `Услуга ${serviceId} убрана у специалиста ${specialistId}`,
    );
  }

  // Назначить локацию специалисту
  async assignLocation(specialistId: string, dto: AssignLocationDto) {
    // Проверяем существование специалиста
    const specialist = await this.prisma.specialist.findUnique({
      where: { id: specialistId },
    });

    if (!specialist) {
      throw new NotFoundException(
        `Специалист с ID ${specialistId} не найден`,
      );
    }

    try {
      const specialistLocation = await this.prisma.specialistLocation.create({
        data: {
          specialistId,
          locationId: dto.locationId,
          organizationId: dto.organizationId,
        },
      });

      this.logger.log(
        `Локация ${dto.locationId} назначена специалисту ${specialistId}`,
      );
      return specialistLocation;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          'Эта локация уже назначена данному специалисту',
        );
      }
      throw error;
    }
  }

  // Убрать локацию у специалиста
  async unassignLocation(
    specialistId: string,
    locationId: string,
  ): Promise<void> {
    const record = await this.prisma.specialistLocation.findUnique({
      where: {
        specialistId_locationId: {
          specialistId,
          locationId,
        },
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Связь специалиста ${specialistId} с локацией ${locationId} не найдена`,
      );
    }

    await this.prisma.specialistLocation.delete({
      where: {
        specialistId_locationId: {
          specialistId,
          locationId,
        },
      },
    });

    this.logger.log(
      `Локация ${locationId} убрана у специалиста ${specialistId}`,
    );
  }

  // Получить специалистов по организации
  async findByOrganization(
    organizationId: string,
    filters: SpecialistFiltersDto,
  ) {
    return this.findAll({ ...filters, organizationId });
  }

  // Получить специалистов по локации
  async findByLocation(locationId: string, organizationId: string) {
    const specialistLocations =
      await this.prisma.specialistLocation.findMany({
        where: {
          locationId,
          organizationId,
        },
        include: {
          specialist: {
            include: {
              services: {
                include: {
                  service: true,
                },
              },
              locations: true,
            },
          },
        },
      });

    return specialistLocations.map((sl) => sl.specialist);
  }
}
