import { IsBoolean } from 'class-validator';

export class ToggleProposalTemplateDto {
  @IsBoolean()
  isActive: boolean;
}
