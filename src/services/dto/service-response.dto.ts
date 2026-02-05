import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceVariationResponseDto {
  @ApiProperty({ description: 'ID вариации' })
  id: string;

  @ApiProperty({ description: 'Название вариации' })
  name: string;

  @ApiProperty({ description: 'Цена вариации' })
  price: number;

  @ApiProperty({ description: 'Активна ли вариация' })
  isActive: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

export class ServiceTypeInResponseDto {
  @ApiProperty({ description: 'ID типа' })
  id: string;

  @ApiProperty({ description: 'Название типа' })
  name: string;
}

export class ServiceResponseDto {
  @ApiProperty({ description: 'ID услуги' })
  id: string;

  @ApiProperty({ description: 'ID организации' })
  organizationId: string;

  @ApiPropertyOptional({ description: 'ID филиала' })
  branchId: string | null;

  @ApiProperty({ description: 'Название услуги' })
  name: string;

  @ApiPropertyOptional({ description: 'Описание услуги' })
  description: string | null;

  @ApiProperty({ description: 'Тип услуги', type: ServiceTypeInResponseDto })
  type: ServiceTypeInResponseDto;

  @ApiPropertyOptional({ description: 'Цена услуги (если нет вариаций)' })
  price: number | null;

  @ApiPropertyOptional({ description: 'ID изображения' })
  imageId: string | null;

  @ApiProperty({ description: 'Активна ли услуга' })
  isActive: boolean;

  @ApiProperty({
    description: 'Вариации услуги',
    type: [ServiceVariationResponseDto],
  })
  variations: ServiceVariationResponseDto[];

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
