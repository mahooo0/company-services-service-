import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignServiceDto {
  @ApiProperty({ description: 'ID услуги' })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'ID организации' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
}
