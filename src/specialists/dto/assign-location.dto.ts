import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignLocationDto {
  @ApiProperty({ description: 'ID локации' })
  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
}
