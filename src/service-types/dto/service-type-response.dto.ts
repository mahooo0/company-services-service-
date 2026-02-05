import { ApiProperty } from '@nestjs/swagger';

export class ServiceCategoryInTypeDto {
  @ApiProperty({ description: 'ID категории' })
  id: string;

  @ApiProperty({ description: 'Название категории' })
  name: string;

  @ApiProperty({ description: 'Slug категории' })
  slug: string;
}

export class ServiceTypeResponseDto {
  @ApiProperty({ description: 'ID типа услуги' })
  id: string;

  @ApiProperty({ description: 'Название типа услуги' })
  name: string;

  @ApiProperty({ description: 'Slug типа услуги' })
  slug: string;

  @ApiProperty({ description: 'ID категории' })
  categoryId: string;

  @ApiProperty({ description: 'Категория', type: ServiceCategoryInTypeDto })
  category?: ServiceCategoryInTypeDto;

  @ApiProperty({
    description: 'Статус типа',
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
  })
  status: string;

  @ApiProperty({
    description: 'ID пользователя, предложившего тип',
    nullable: true,
  })
  suggestedByUserId: string | null;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
