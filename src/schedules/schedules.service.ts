import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import { EventPublisherService } from '@/events/event-publisher.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  BulkUpdateScheduleDto,
  ScheduleResponseDto,
  ScheduleIntervalDto,
} from './dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  // Преобразование в DTO ответа
  private toResponseDto(schedule: any): ScheduleResponseDto {
    return {
      id: schedule.id,
      organizationId: schedule.organizationId,
      specialistId: schedule.specialistId,
      locationId: schedule.locationId,
      dayOfWeek: schedule.dayOfWeek,
      intervals: schedule.intervals as ScheduleIntervalDto[],
      isDayOff: schedule.isDayOff,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  // Валидация интервалов: проверка на пересечения
  private validateIntervals(intervals: ScheduleIntervalDto[]): void {
    if (!intervals || intervals.length === 0) return;

    // Преобразуем время в минуты для сравнения
    const toMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Сортируем по startTime
    const sorted = [...intervals].sort(
      (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
    );

    for (let i = 0; i < sorted.length; i++) {
      const start = toMinutes(sorted[i].startTime);
      const end = toMinutes(sorted[i].endTime);

      if (start >= end) {
        throw new BadRequestException(
          `Время начала (${sorted[i].startTime}) должно быть раньше времени окончания (${sorted[i].endTime})`,
        );
      }

      if (i > 0) {
        const prevEnd = toMinutes(sorted[i - 1].endTime);
        if (start < prevEnd) {
          throw new BadRequestException(
            `Интервалы пересекаются: ${sorted[i - 1].startTime}-${sorted[i - 1].endTime} и ${sorted[i].startTime}-${sorted[i].endTime}`,
          );
        }
      }
    }
  }

  // Получить расписание специалиста в локации (все 7 дней)
  async findBySpecialistAndLocation(
    specialistId: string,
    locationId: string,
  ): Promise<ScheduleResponseDto[]> {
    const schedules = await this.prisma.schedule.findMany({
      where: { specialistId, locationId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return schedules.map(s => this.toResponseDto(s));
  }

  // Получить все расписания для локации, сгруппированные по специалисту
  async findByLocation(
    locationId: string,
    organizationId: string,
  ): Promise<Record<string, ScheduleResponseDto[]>> {
    const schedules = await this.prisma.schedule.findMany({
      where: { locationId, organizationId },
      orderBy: [{ specialistId: 'asc' }, { dayOfWeek: 'asc' }],
    });

    const grouped: Record<string, ScheduleResponseDto[]> = {};

    for (const schedule of schedules) {
      if (!grouped[schedule.specialistId]) {
        grouped[schedule.specialistId] = [];
      }
      grouped[schedule.specialistId].push(this.toResponseDto(schedule));
    }

    return grouped;
  }

  // Создать расписание (upsert по specialistId+locationId+dayOfWeek)
  async create(dto: CreateScheduleDto): Promise<ScheduleResponseDto> {
    this.validateIntervals(dto.intervals);

    const schedule = await this.prisma.schedule.upsert({
      where: {
        specialistId_locationId_dayOfWeek: {
          specialistId: dto.specialistId,
          locationId: dto.locationId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      update: {
        intervals: dto.intervals as any,
        isDayOff: dto.isDayOff ?? false,
      },
      create: {
        organizationId: dto.organizationId,
        specialistId: dto.specialistId,
        locationId: dto.locationId,
        dayOfWeek: dto.dayOfWeek,
        intervals: dto.intervals as any,
        isDayOff: dto.isDayOff ?? false,
      },
    });

    this.logger.log(
      `Создано/обновлено расписание: специалист ${dto.specialistId}, локация ${dto.locationId}, день ${dto.dayOfWeek} (${schedule.id})`,
    );

    const responseDto = this.toResponseDto(schedule);
    this.eventPublisher.publishScheduleEvent('schedule.created', responseDto);

    return responseDto;
  }

  // Обновить расписание по ID
  async update(
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const existing = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Расписание с ID ${id} не найдено`);
    }

    if (dto.intervals) {
      this.validateIntervals(dto.intervals);
    }

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        intervals:
          dto.intervals !== undefined ? (dto.intervals as any) : undefined,
        isDayOff: dto.isDayOff,
      },
    });

    this.logger.log(`Обновлено расписание: ${schedule.id}`);

    const responseDto = this.toResponseDto(schedule);
    this.eventPublisher.publishScheduleEvent('schedule.updated', responseDto);

    return responseDto;
  }

  // Массовое обновление расписания (upsert нескольких дней в транзакции)
  async bulkUpdate(dto: BulkUpdateScheduleDto): Promise<ScheduleResponseDto[]> {
    // Валидируем интервалы для каждого дня
    for (const item of dto.items) {
      this.validateIntervals(item.intervals);
    }

    const schedules = await this.prisma.$transaction(
      dto.items.map(item =>
        this.prisma.schedule.upsert({
          where: {
            specialistId_locationId_dayOfWeek: {
              specialistId: dto.specialistId,
              locationId: dto.locationId,
              dayOfWeek: item.dayOfWeek,
            },
          },
          update: {
            intervals: item.intervals as any,
            isDayOff: item.isDayOff ?? false,
          },
          create: {
            organizationId: dto.organizationId,
            specialistId: dto.specialistId,
            locationId: dto.locationId,
            dayOfWeek: item.dayOfWeek,
            intervals: item.intervals as any,
            isDayOff: item.isDayOff ?? false,
          },
        }),
      ),
    );

    this.logger.log(
      `Массовое обновление расписания: специалист ${dto.specialistId}, локация ${dto.locationId}, дней: ${dto.items.length}`,
    );

    return schedules.map(s => this.toResponseDto(s));
  }

  // Удалить расписание по ID
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Расписание с ID ${id} не найдено`);
    }

    await this.prisma.schedule.delete({
      where: { id },
    });

    this.logger.log(`Удалено расписание: ${id}`);

    this.eventPublisher.publishScheduleEvent('schedule.deleted', {
      id,
      organizationId: existing.organizationId,
      specialistId: existing.specialistId,
      locationId: existing.locationId,
    });
  }
}
