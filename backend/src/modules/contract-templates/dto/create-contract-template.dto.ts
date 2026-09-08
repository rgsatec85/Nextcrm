import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContractTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  // Categoria livre (mesmo raciocínio de ProposalTemplate.category) — sem
  // lista fechada no backend.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  // Corpo padrão do modelo, em HTML (rich text do editor do frontend) —
  // saneado no service (sanitizeContractBody) antes de persistir. Campos
  // dinâmicos ({{cliente.nome}}, {{valor}}, {{vigencia_inicio}},
  // {{vigencia_fim}}, {{vendedor}}, {{data}}) são substituídos só quando o
  // modelo é aplicado a um contrato (ver ContractsService.applyTemplate).
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
