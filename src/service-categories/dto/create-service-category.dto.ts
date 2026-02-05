import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ description: 'Название категории', example: 'Ветклініки' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Slug категории (латиница, цифры, подчеркивания)',
    example: 'vet_clinics',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Slug может содержать только латинские буквы, цифры и подчеркивания',
  })
  slug: string;
}
