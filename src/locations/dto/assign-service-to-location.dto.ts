import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignServiceToLocationDto {
  @ApiProperty({ description: 'ID услуги' })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
}
