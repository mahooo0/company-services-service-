import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceVariationDto {
  @ApiPropertyOptional({
    description: 'ID вариации (для обновления существующей)',
  })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Название вариации' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Цена вариации' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Активна ли вариация' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'ID филиала (точки)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Название услуги' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Описание услуги' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'ID типа услуги' })
  @IsUUID()
  @IsOptional()
  typeId?: string;

  @ApiPropertyOptional({ description: 'Цена услуги (если нет вариаций)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'ID изображения из storage service' })
  @IsUUID()
  @IsOptional()
  imageId?: string;

  @ApiPropertyOptional({ description: 'Активна ли услуга' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Вариации услуги (для обновления/добавления)',
    type: [UpdateServiceVariationDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceVariationDto)
  variations?: UpdateServiceVariationDto[];

  @ApiPropertyOptional({
    description: 'ID вариаций для удаления',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  deleteVariationIds?: string[];
}
