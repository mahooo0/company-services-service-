import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateServiceTypeDto {
  @ApiProperty({ description: 'Название типа услуги', example: 'Маникюр' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
