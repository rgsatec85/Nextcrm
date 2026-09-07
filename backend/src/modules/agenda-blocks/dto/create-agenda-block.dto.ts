import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgendaBlockDto {
  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
