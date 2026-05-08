import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestBusinessDto {
  @ApiProperty({ example: 'business' })
  type!: 'business';

  @ApiProperty({ example: '8c2b0c1a-...' })
  id!: string;

  @ApiProperty({ example: 'Lapka Pet Salon' })
  name!: string;

  @ApiPropertyOptional({ example: 'GROOMING' })
  category?: string;

  @ApiPropertyOptional({ example: 4.7 })
  rating?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/banner.jpg' })
  banner?: string;

  @ApiPropertyOptional({
    description: 'Distance to user in km, present only when lat/lon provided',
    example: 1.42,
  })
  distanceKm?: number;

  @ApiPropertyOptional({
    description: 'Computed at section-composer time from workTime + UTC+3',
    example: true,
  })
  isOpenNow?: boolean;

  @ApiPropertyOptional({
    description: 'ES highlight wrapped in <em>...</em>',
    example: { name: ['<em>Lapka</em> Pet Salon'] },
  })
  highlight?: { name?: string[]; description?: string[] };
}
