import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { QuoteItemDto } from '../../quotes/dto/quote-item.dto';
import { ORDER_STATUSES } from './update-order-status.dto';

// Fase 7 (spec v3.1, RF012) — Pedido criado manualmente, sem proposta
// associada (`quoteId` permanece opcional no schema desde a Fase 1, mas
// nunca havia um jeito de criar um Pedido sem passar por
// QuotesService.approve()/convertToOrder() até agora). Reusa QuoteItemDto
// porque o formato de item (descrição/quantidade/preço unitário) é
// idêntico ao de proposta — não há razão para duplicar a validação.
export class CreateOrderDto {
  @IsUUID()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

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

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: string;
}
