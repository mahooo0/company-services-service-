import { ApiProperty } from '@nestjs/swagger';
import { SuggestCategoryDto } from './suggest-category.dto';
import { SuggestBusinessDto } from './suggest-business.dto';
import { SuggestServiceDto } from './suggest-service.dto';

export class SuggestSectionsDto {
  @ApiProperty({ type: [SuggestCategoryDto] })
  categories!: SuggestCategoryDto[];

  @ApiProperty({ type: [SuggestBusinessDto] })
  businesses!: SuggestBusinessDto[];

  @ApiProperty({ type: [SuggestServiceDto] })
  services!: SuggestServiceDto[];
}

export class SuggestResponseDto {
  @ApiProperty({ example: 'груми' })
  query!: string;

  @ApiProperty({
    enum: ['category', 'business', 'service', 'general'],
    example: 'category',
  })
  intent!: 'category' | 'business' | 'service' | 'general';

  @ApiProperty({ type: SuggestSectionsDto })
  sections!: SuggestSectionsDto;

  @ApiProperty({ description: 'Server-side time in ms', example: 28 })
  took!: number;

  @ApiProperty({
    description: 'Forward-compat flag — Phase 9 will set this to true on hits',
    example: false,
  })
  cached!: boolean;
}
