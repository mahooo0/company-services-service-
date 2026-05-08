import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestCategoryDto {
  @ApiProperty({ example: 'category' })
  type!: 'category';

  @ApiProperty({ example: 'grooming' })
  id!: string;

  @ApiProperty({
    description: 'Localized category names',
    example: { ru: 'Грумминг', uk: 'Грумінг', en: 'Grooming', az: 'Qrooming' },
  })
  names!: { ru: string; uk: string; en: string; az: string };

  @ApiPropertyOptional({ example: '✂️' })
  icon?: string;

  @ApiPropertyOptional({ example: '#FF6B6B' })
  color?: string;

  @ApiPropertyOptional({ example: 0.85 })
  popularity?: number;
}
