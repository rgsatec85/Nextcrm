import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOpportunityDto } from './create-opportunity.dto';

// Reatribuir a oportunidade a outro cliente não é suportado na Fase 1 —
// cria-se uma nova oportunidade nesse caso.
export class UpdateOpportunityDto extends PartialType(
  OmitType(CreateOpportunityDto, ['customerId'] as const),
) {}
