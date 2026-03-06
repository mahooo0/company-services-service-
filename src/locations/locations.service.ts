import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import { AssignServiceToLocationDto } from './dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  // Получить все услуги, привязанные к локации
  async findServicesByLocation(locationId: string, organizationId: string) {
    const locationServices = await this.prisma.locationService.findMany({
      where: {
        locationId,
        organizationId,
      },
      include: {
        service: {
          include: {
            type: true,
            variations: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return locationServices.map(ls => ls.service);
  }

  // Привязать услугу к локации
  async assignService(locationId: string, dto: AssignServiceToLocationDto) {
    // Проверяем, что услуга существует
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Услуга с ID ${dto.serviceId} не найдена`);
    }

    // Проверяем уникальность связи
    const existing = await this.prisma.locationService.findUnique({
      where: {
        locationId_serviceId: {
          locationId,
          serviceId: dto.serviceId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Услуга уже привязана к этой локации');
    }

    const locationService = await this.prisma.locationService.create({
      data: {
        locationId,
        serviceId: dto.serviceId,
        organizationId: dto.organizationId,
      },
      include: {
        service: {
          include: {
            type: true,
            variations: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    this.logger.log(
      `Услуга ${dto.serviceId} привязана к локации ${locationId}`,
    );

    return locationService;
  }

  // Отвязать услугу от локации
  async unassignService(locationId: string, serviceId: string) {
    const existing = await this.prisma.locationService.findUnique({
      where: {
        locationId_serviceId: {
          locationId,
          serviceId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Связь услуги ${serviceId} с локацией ${locationId} не найдена`,
      );
    }

    await this.prisma.locationService.delete({
      where: {
        locationId_serviceId: {
          locationId,
          serviceId,
        },
      },
    });

    this.logger.log(`Услуга ${serviceId} отвязана от локации ${locationId}`);
  }

  // Получить всех специалистов, привязанных к локации
  async findSpecialistsByLocation(locationId: string, organizationId: string) {
    const specialistLocations = await this.prisma.specialistLocation.findMany({
      where: {
        locationId,
        organizationId,
      },
      include: {
        specialist: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return specialistLocations.map(sl => sl.specialist);
  }
}
