import { IsDateString, IsOptional } from 'class-validator';

// Se newEndDate não for informado, a renovação estende o contrato por
// `renewalPeriodMonths` (precisa estar preenchido no contrato).
export class RenewContractDto {
  @IsOptional()
  @IsDateString()
  newEndDate?: string;
}
