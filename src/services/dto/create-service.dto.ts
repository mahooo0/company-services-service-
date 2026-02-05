import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceVariationDto {
  @ApiProperty({ description: 'Название вариации', example: 'Стандартный' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Цена вариации', example: 500 })
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateServiceDto {
  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiPropertyOptional({ description: 'ID филиала (точки)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Название услуги', example: 'Стрижка' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Описание услуги' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'ID типа услуги' })
  @IsUUID()
  @IsNotEmpty()
  typeId: string;

  @ApiPropertyOptional({
    description: 'Цена услуги (если нет вариаций)',
    example: 1000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'ID изображения из storage service' })
  @IsUUID()
  @IsOptional()
  imageId?: string;

  @ApiPropertyOptional({
    description: 'Вариации услуги',
    type: [CreateServiceVariationDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceVariationDto)
  variations?: CreateServiceVariationDto[];
}
