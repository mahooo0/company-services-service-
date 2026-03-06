import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleIntervalDto } from './schedule-interval.dto';

export class BulkScheduleItemDto {
  @ApiProperty({ description: 'День недели (0-6)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Интервалы работы', type: [ScheduleIntervalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  intervals: ScheduleIntervalDto[];

  @ApiPropertyOptional({ description: 'Выходной день', default: false })
  @IsBoolean()
  @IsOptional()
  isDayOff?: boolean;
}

export class BulkUpdateScheduleDto {
  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ description: 'ID специалиста' })
  @IsUUID()
  @IsNotEmpty()
  specialistId: string;

  @ApiProperty({ description: 'ID локации' })
  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Расписание по дням',
    type: [BulkScheduleItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkScheduleItemDto)
  items: BulkScheduleItemDto[];
}
