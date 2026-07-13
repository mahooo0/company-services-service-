import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A seed (non-partner) company: a scraped business that is not registered on
 * the platform. It has contacts and a location and nothing else — no services,
 * no schedule, no reviews. Its rating is deliberately not exposed: it comes
 * from a third-party source we do not vouch for.
 */
export class SeedCompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Category enum, e.g. "VET_CLINICS".' })
  category: string;

  @ApiProperty({ description: 'Category slug, e.g. "vet-clinics".' })
  categorySlug: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City or locality.' })
  city?: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  facebook?: string;

  @ApiPropertyOptional()
  instagram?: string;

  @ApiPropertyOptional()
  whatsapp?: string;
}
