import { ApiProperty } from '@nestjs/swagger';
import { ScheduleIntervalDto } from './schedule-interval.dto';

export class ScheduleResponseDto {
  @ApiProperty({ description: 'ID расписания' })
  id: string;

  @ApiProperty({ description: 'ID организации' })
  organizationId: string;

  @ApiProperty({ description: 'ID специалиста' })
  specialistId: string;

  @ApiProperty({ description: 'ID локации' })
  locationId: string;

  @ApiProperty({ description: 'День недели (0-6)' })
  dayOfWeek: number;

  @ApiProperty({ description: 'Интервалы работы', type: [ScheduleIntervalDto] })
  intervals: ScheduleIntervalDto[];

  @ApiProperty({ description: 'Выходной день' })
  isDayOff: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
