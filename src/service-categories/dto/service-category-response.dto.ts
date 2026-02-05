import { ApiProperty } from '@nestjs/swagger';

export class ServiceTypeInCategoryDto {
  @ApiProperty({ description: 'ID типа' })
  id: string;

  @ApiProperty({ description: 'Название типа' })
  name: string;

  @ApiProperty({ description: 'Slug типа' })
  slug: string;

  @ApiProperty({ description: 'Статус типа' })
  status: string;
}

export class ServiceCategoryResponseDto {
  @ApiProperty({ description: 'ID категории' })
  id: string;

  @ApiProperty({ description: 'Название категории' })
  name: string;

  @ApiProperty({ description: 'Slug категории' })
  slug: string;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}

export class ServiceCategoryWithTypesResponseDto extends ServiceCategoryResponseDto {
  @ApiProperty({
    description: 'Типы услуг в категории',
    type: [ServiceTypeInCategoryDto],
  })
  types: ServiceTypeInCategoryDto[];
}
