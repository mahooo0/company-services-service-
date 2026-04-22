import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchSortBy {
  RELEVANCE = 'relevance',
  DISTANCE = 'distance',
  RATING = 'rating',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Поисковый запрос', example: 'стрижка' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  q?: string;

  @ApiPropertyOptional({ description: 'Широта пользователя', example: 40.4093 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Долгота пользователя',
    example: 49.8671,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lon?: number;

  @ApiPropertyOptional({
    description: 'Радиус поиска в км (1-100)',
    example: 10,
    default: 25,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  radius?: number = 25;

  @ApiPropertyOptional({
    description: 'Минимальный рейтинг (0-5)',
    example: 4,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ description: 'Минимальная цена' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceMin?: number;

  @ApiPropertyOptional({ description: 'Максимальная цена' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceMax?: number;

  @ApiPropertyOptional({ description: 'ID категории услуги' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'ID типа услуги' })
  @IsUUID()
  @IsOptional()
  typeId?: string;

  @ApiPropertyOptional({
    description: 'Сортировка',
    enum: SearchSortBy,
    default: SearchSortBy.RELEVANCE,
  })
  @IsEnum(SearchSortBy)
  @IsOptional()
  sort?: SearchSortBy = SearchSortBy.RELEVANCE;

  @ApiPropertyOptional({ description: 'Номер страницы', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество на странице',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class SuggestQueryDto {
  @ApiPropertyOptional({
    description: 'Текст для автокомплита (мин 2 символа)',
    example: 'стр',
  })
  @IsString()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({ description: 'Широта пользователя' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({ description: 'Долгота пользователя' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lon?: number;

  @ApiPropertyOptional({
    description: 'Максимум подсказок (1-10)',
    default: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  limit?: number = 5;
}
