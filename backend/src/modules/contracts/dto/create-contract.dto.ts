import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  renewalPeriodMonths?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  // Fase 9 (RF013) — corpo rich text (HTML), saneado no service antes de
  // persistir (ver sanitize-contract-body.ts). Opcional: um contrato pode
  // nascer sem corpo e ganhar um depois, via edição direta ou applyTemplate.
  @IsOptional()
  @IsString()
  body?: string;

  // Modelo de origem, aplicado só na criação — trocar o modelo de um
  // contrato já existente passa pelo endpoint dedicado
  // PATCH /:id/apply-template (ver UpdateContractDto, que exclui este
  // campo), nunca por um PATCH genérico.
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
