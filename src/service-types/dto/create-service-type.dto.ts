import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateServiceTypeDto {
  @ApiProperty({ description: 'Название типа услуги', example: 'Стрижка' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Slug типа (латиница, цифры, подчеркивания)',
    example: 'haircut',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'Slug может содержать только латинские буквы, цифры и подчеркивания',
  })
  slug: string;

  @ApiProperty({ description: 'ID категории' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;
}
