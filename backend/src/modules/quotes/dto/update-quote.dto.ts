import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { QuoteItemDto } from './quote-item.dto';

// Só os itens podem ser editados (e só enquanto a proposta está em
// rascunho — ver QuotesService.update). opportunityId e version não mudam.
export class UpdateQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
