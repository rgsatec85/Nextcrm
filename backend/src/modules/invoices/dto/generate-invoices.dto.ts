import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const PAYMENT_METHODS = ['pix', 'boleto', 'cartao'] as const;

// Gera as parcelas (contas a receber) de um Pedido. Regra simples: divide o
// totalValue igualmente entre as parcelas, com a última absorvendo o
// arredondamento — e datas de vencimento espaçadas por `intervalDays`
// (padrão 30) a partir de `firstDueDate`.
export class GenerateInvoicesDto {
  @IsInt()
  @Min(1)
  @Max(24)
  installments: number;

  @IsDateString()
  firstDueDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  intervalDays?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;
}
