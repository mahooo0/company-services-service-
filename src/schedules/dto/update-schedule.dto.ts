import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleIntervalDto } from './schedule-interval.dto';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    description: 'Интервалы работы',
    type: [ScheduleIntervalDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  intervals?: ScheduleIntervalDto[];

  @ApiPropertyOptional({ description: 'Выходной день' })
  @IsBoolean()
  @IsOptional()
  isDayOff?: boolean;
}
