import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProposalTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  // Categoria livre (ver comentário em 0007_fase6_propostas.sql) — sugestões
  // da UI: 'venda_servico' | 'venda_produto' | 'locacao' | 'consultoria' |
  // 'outro', mas o backend não valida contra uma lista fechada.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  headerText?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  // Cláusulas padrão do modelo — texto livre com campos dinâmicos
  // ({{cliente.nome}}, {{valor_total}}, {{vendedor}}, {{data}}) substituídos
  // na geração do PDF (ver ProposalPdfService).
  @IsOptional()
  @IsString()
  clauses?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
