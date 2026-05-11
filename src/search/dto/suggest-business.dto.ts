import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Shape mirrors main /search BranchResult so suggest businesses are
// drop-in compatible with the BranchResult consumer on the frontend.
// quick-260511-h2n: align suggest with /search shape.

export class SuggestOrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  slug!: string | null;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  avatar!: string | null;

  @ApiProperty()
  averageRating!: number;

  @ApiProperty()
  reviewCount!: number;
}

export class SuggestBranchDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ nullable: true })
  address!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lon!: number;

  @ApiProperty({
    nullable: true,
    description: 'km, present only when geo provided',
  })
  distance!: number | null;

  @ApiProperty({ nullable: true })
  workTime!: unknown;
}

export class SuggestServiceVariationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  price!: number;
}

export class SuggestServiceItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  price!: number | null;

  @ApiProperty({ nullable: true })
  imageId!: string | null;

  @ApiProperty()
  typeName!: string;

  @ApiProperty()
  typeSlug!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty()
  categorySlug!: string;

  @ApiProperty({ type: [SuggestServiceVariationDto] })
  variations!: SuggestServiceVariationDto[];
}

export class SuggestBusinessDto {
  @ApiProperty({ example: 'business' })
  type!: 'business';

  @ApiProperty({ type: SuggestOrganizationDto })
  organization!: SuggestOrganizationDto;

  @ApiProperty({ type: SuggestBranchDto })
  branch!: SuggestBranchDto;

  @ApiProperty({ type: [SuggestServiceItemDto] })
  services!: SuggestServiceItemDto[];

  @ApiPropertyOptional({
    description:
      'Top-level convenience copy of branch.distance, present when geo provided',
    example: 1.42,
  })
  distanceKm?: number;

  @ApiPropertyOptional({
    description: 'Computed from branch.workTime + UTC+3',
    example: true,
  })
  isOpenNow?: boolean;

  @ApiPropertyOptional({
    description: 'Highlight wrapped in <em>...</em>',
    example: { name: ['<em>Lapka</em> Pet Salon'] },
  })
  highlight?: { name?: string[]; description?: string[] };
}
