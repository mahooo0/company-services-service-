import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ScheduleIntervalDto {
  @ApiProperty({ description: 'Время начала', example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Формат времени: HH:MM' })
  startTime: string;

  @ApiProperty({ description: 'Время окончания', example: '17:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Формат времени: HH:MM' })
  endTime: string;
}
