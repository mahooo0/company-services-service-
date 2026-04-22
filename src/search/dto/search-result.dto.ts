import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  price?: number;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  imageId?: string;

  @ApiProperty()
  typeName: string;

  @ApiProperty()
  typeSlug: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categorySlug: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  organizationName: string;

  @ApiPropertyOptional()
  organizationAvatar?: string;

  @ApiProperty()
  organizationRating: number;

  @ApiProperty()
  organizationReviewCount: number;

  @ApiProperty({ description: 'ID точки (филиала) где доступна услуга' })
  branchId: string;

  @ApiPropertyOptional({ description: 'Название точки' })
  branchName?: string;

  @ApiPropertyOptional({ description: 'Расстояние до точки в км' })
  distance?: number;

  @ApiPropertyOptional({ description: 'Адрес точки' })
  branchAddress?: string;

  @ApiPropertyOptional({ description: 'Город точки' })
  branchCity?: string;
}

export class OrganizationSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  reviewCount: number;

  @ApiProperty({ description: 'Кол-во услуг в этой точке' })
  serviceCount: number;

  @ApiProperty({ description: 'ID точки (филиала)' })
  branchId: string;

  @ApiPropertyOptional({ description: 'Название точки' })
  branchName?: string;

  @ApiPropertyOptional({ description: 'Адрес точки' })
  branchAddress?: string;

  @ApiPropertyOptional({ description: 'Город точки' })
  branchCity?: string;

  @ApiPropertyOptional({ description: 'Расстояние до точки в км' })
  distance?: number;
}

export class SuggestResultDto {
  @ApiProperty({ enum: ['service', 'organization'] })
  type: 'service' | 'organization';

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  extra?: string;
}

export class PaginatedResultDto<T> {
  @ApiProperty()
  data: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasMore: boolean;
}
