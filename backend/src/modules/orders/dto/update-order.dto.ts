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
import { QuoteItemDto } from '../../quotes/dto/quote-item.dto';

// Fase 7 (spec v3.1, RF012) — edição de um Pedido já existente (itens
// editáveis, prazo de entrega, condição de pagamento, observações
// internas). Ver a trava em OrdersService.update(): não permite reescrever
// `items` (e portanto o valor total) depois que já existe fatura gerada
// para o pedido — os outros campos continuam editáveis livremente.
export class UpdateOrderDto {
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
