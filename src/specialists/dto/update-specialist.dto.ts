import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSpecialistDto } from './create-specialist.dto';

export class UpdateSpecialistDto extends PartialType(
  OmitType(CreateSpecialistDto, ['organizationId'] as const),
) {}
