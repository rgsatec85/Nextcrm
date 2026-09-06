import { IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { PAYMENT_METHODS } from './generate-invoices.dto';

export class PayInvoiceDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
