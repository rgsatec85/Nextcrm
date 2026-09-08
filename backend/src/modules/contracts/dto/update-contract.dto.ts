import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateContractDto } from './create-contract.dto';

// `templateId` fica de fora do PATCH genérico deliberadamente — trocar/
// aplicar um modelo é uma ação própria (PATCH /:id/apply-template, só em
// contratos 'rascunho'), não um campo editável solto.
export class UpdateContractDto extends PartialType(
  OmitType(CreateContractDto, ['customerId', 'templateId'] as const),
) {}
