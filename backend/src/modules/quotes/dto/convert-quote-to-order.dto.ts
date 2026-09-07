import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { QuoteItemDto } from './quote-item.dto';

// Fase 7 (spec v3.1, RF012) — conversão explícita de proposta aprovada em
// Pedido. Todos os campos são opcionais: sem nada informado, o Pedido herda
// os itens/valor da própria proposta (mesmo comportamento da conversão
// automática que esta fase substitui) — informar `items` permite revisar
// quantidades/preços antes de confirmar, sem precisar editar a proposta em
// si (que já não pode mais ser editada depois de aprovada).
export class ConvertQuoteToOrderDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
