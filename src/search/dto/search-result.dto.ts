import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchServiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  price?: number;

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

  @ApiPropertyOptional()
  variations?: { id: string; name: string; price: number }[];
}

export class SearchBranchDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;

  @ApiPropertyOptional()
  distance?: number;

  @ApiPropertyOptional()
  workTime?: any;
}

export class SearchOrganizationDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  slug?: string;

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
}

export class SearchResultItemDto {
  @ApiProperty({ type: SearchOrganizationDto })
  organization: SearchOrganizationDto;

  @ApiPropertyOptional({ type: SearchBranchDto })
  branch?: SearchBranchDto;

  @ApiProperty({ type: [SearchServiceDto] })
  services: SearchServiceDto[];
}

export class SuggestResultDto {
  @ApiProperty({ enum: ['service', 'organization', 'category'] })
  type: 'service' | 'organization' | 'category';

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  extra?: string;
}
