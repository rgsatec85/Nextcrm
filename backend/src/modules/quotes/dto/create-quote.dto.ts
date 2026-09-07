import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { QuoteItemDto } from './quote-item.dto';

export class CreateQuoteDto {
  @IsUUID()
  opportunityId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  // Fase 6 (spec v3.1, RF011) — ambos opcionais: propostas sem prazo de
  // validade definido ou sem modelo escolhido continuam funcionando como
  // antes (PDF cai no layout padrão sem cor/cabeçalho/cláusulas de modelo).
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}
