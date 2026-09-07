import { IsIn } from 'class-validator';

export const TICKET_STATUSES = [
  'aberto',
  'em_andamento',
  'resolvido',
  'fechado',
] as const;

export class UpdateTicketStatusDto {
  @IsIn(TICKET_STATUSES)
  status: string;
}
