import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TICKET_PRIORITIES = ['baixa', 'media', 'alta', 'urgente'] as const;

// Criação interna (rota /tickets) — quem abre é um usuário interno em nome
// de um cliente, então customerId é obrigatório aqui. A criação pelo Portal
// usa CreatePortalTicketDto (sem customerId — hard lock no PortalService).
export class CreateTicketDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
