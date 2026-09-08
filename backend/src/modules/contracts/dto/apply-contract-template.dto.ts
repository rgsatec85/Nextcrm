import { IsUUID } from 'class-validator';

export class ApplyContractTemplateDto {
  @IsUUID()
  templateId: string;
}
