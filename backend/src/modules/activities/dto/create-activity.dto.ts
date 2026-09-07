import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const ACTIVITY_TYPES = [
  'reuniao',
  'ligacao',
  'follow_up',
  'nota',
  // Fase 8 (RF016) — tipos de propósito geral: não exigem customerId nem
  // opportunityId (ver ActivitiesService.create), para caber um compromisso
  // pessoal/interno que não é, em si, um registro de CRM.
  'tarefa',
  'evento',
] as const;

// Tipos que continuam obrigatoriamente ligados a um cliente e/ou
// oportunidade — o comportamento original de "atividade = registro de CRM"
// desde a Fase 1.
export const CRM_LINKED_ACTIVITY_TYPES = [
  'reuniao',
  'ligacao',
  'follow_up',
  'nota',
] as const;

export class CreateActivityDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsIn(ACTIVITY_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  // Fase 8 — fim do compromisso. Só faz sentido junto de scheduledAt; a
  // dupla vira um "slot" de calendário sujeito à checagem de conflito (ver
  // ActivitiesService.create).
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
