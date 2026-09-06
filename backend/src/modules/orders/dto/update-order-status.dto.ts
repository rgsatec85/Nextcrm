import { IsIn } from 'class-validator';

export const ORDER_STATUSES = [
  'confirmado',
  'em_andamento',
  'concluido',
  'cancelado',
] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status: string;
}
