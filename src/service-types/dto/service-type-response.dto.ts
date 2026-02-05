import { ApiProperty } from '@nestjs/swagger';

export class ServiceTypeResponseDto {
  @ApiProperty({ description: 'ID типа услуги' })
  id: string;

  @ApiProperty({ description: 'Название типа услуги' })
  name: string;

  @ApiProperty({
    description: 'Статус типа',
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
  })
  status: string;

  @ApiProperty({ description: 'ID пользователя, предложившего тип', nullable: true })
  suggestedByUserId: string | null;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
