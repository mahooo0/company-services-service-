import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SuggestQueryDto {
  @ApiProperty({
    description: 'Search query — trimmed, must be ≥2 chars after trim',
    example: 'груми',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({
    description: 'User latitude (WGS84) for geo-aware ranking',
    example: 50.4501,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({
    description: 'User longitude (WGS84) for geo-aware ranking',
    example: 30.5234,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lon?: number;

  @ApiPropertyOptional({
    description: 'City slug filter (matches addresses.city term)',
    example: 'kyiv',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Result language for boost ordering',
    enum: ['ru', 'uk', 'en'],
    default: 'ru',
  })
  @IsOptional()
  @IsIn(['ru', 'uk', 'en'])
  lang?: 'ru' | 'uk' | 'en';
}
