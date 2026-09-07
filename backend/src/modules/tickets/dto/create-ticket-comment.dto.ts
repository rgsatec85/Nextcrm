import { IsString, MinLength } from 'class-validator';

// Compartilhado entre TicketsController (autor 'interno') e
// PortalController (autor 'cliente') — o author_type é decidido pelo
// service que chama, nunca pelo cliente da API.
export class CreateTicketCommentDto {
  @IsString()
  @MinLength(1)
  body: string;
}
