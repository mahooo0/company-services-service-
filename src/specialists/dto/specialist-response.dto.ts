import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SpecialistResponseDto {
  @ApiProperty({ description: 'ID специалиста' })
  id: string;

  @ApiProperty({ description: 'ID организации' })
  organizationId: string;

  @ApiPropertyOptional({ description: 'Аватар специалиста' })
  avatar: string | null;

  @ApiProperty({ description: 'Имя специалиста' })
  firstName: string;

  @ApiProperty({ description: 'Фамилия специалиста' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Email специалиста' })
  email: string | null;

  @ApiPropertyOptional({ description: 'Телефон специалиста' })
  phone: string | null;

  @ApiPropertyOptional({ description: 'Описание специалиста' })
  description: string | null;

  @ApiProperty({ description: 'Топ-мастер' })
  isTopMaster: boolean;

  @ApiProperty({ description: 'Дата создания' })
  createdAt: Date;

  @ApiProperty({ description: 'Дата обновления' })
  updatedAt: Date;
}
