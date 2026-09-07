import { PartialType } from '@nestjs/mapped-types';
import { CreateProposalTemplateDto } from './create-proposal-template.dto';

export class UpdateProposalTemplateDto extends PartialType(
  CreateProposalTemplateDto,
) {}
