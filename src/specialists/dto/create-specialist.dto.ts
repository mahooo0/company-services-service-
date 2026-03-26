import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateSpecialistDto {
  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiPropertyOptional({ description: 'Аватар специалиста (URL или ID)' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ description: 'Имя специалиста', example: 'Иван' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'Фамилия специалиста', example: 'Иванов' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    description: 'Email специалиста',
    example: 'ivan@example.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Телефон специалиста',
    example: '+380501234567',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Описание специалиста' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Топ-мастер',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isTopMaster?: boolean = false;

  @ApiPropertyOptional({ description: 'ID локации (адреса) для привязки' })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Массив ID услуг для привязки',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  serviceIds?: string[];
}
