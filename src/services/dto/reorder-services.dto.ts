import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderServiceItemDto {
  @ApiProperty({ description: 'Service ID', example: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'New sort order position', example: 1 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderServicesDto {
  @ApiProperty({ type: [ReorderServiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderServiceItemDto)
  items: ReorderServiceItemDto[];
}
