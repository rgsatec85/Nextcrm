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
}
