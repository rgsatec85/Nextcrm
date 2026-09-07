import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TICKET_PRIORITIES } from '../../tickets/dto/create-ticket.dto';

// Sem customerId — hard lock: PortalService sempre usa user.customerId do
// próprio usuário autenticado, nunca um valor vindo do corpo da requisição
// (ver docs/security-multitenancy.md).
export class CreatePortalTicketDto {
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
}
