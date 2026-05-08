import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestServiceDto {
  @ApiProperty({ example: 'service' })
  type!: 'service';

  @ApiProperty({ example: 'd4a1...-...' })
  id!: string;

  @ApiProperty({ example: 'Стрижка собак' })
  name!: string;

  @ApiPropertyOptional({ example: '8c2b0c1a-...' })
  organizationId?: string;

  @ApiPropertyOptional({ example: 'Lapka Pet Salon' })
  organizationName?: string;

  @ApiPropertyOptional({ example: 'GROOMING' })
  organizationCategory?: string;

  @ApiPropertyOptional({ example: 4.7 })
  organizationRating?: number;

  @ApiPropertyOptional({
    description: 'ES highlight wrapped in <em>...</em>',
    example: { name: ['<em>Стрижка</em> собак'] },
  })
  highlight?: { name?: string[] };
}
