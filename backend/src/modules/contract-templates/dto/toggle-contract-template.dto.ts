import { IsBoolean } from 'class-validator';

export class ToggleContractTemplateDto {
  @IsBoolean()
  isActive: boolean;
}
