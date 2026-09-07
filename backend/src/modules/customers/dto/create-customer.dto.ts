import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  segment?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ativo', 'inativo'])
  status?: string;

  // --- Refinamento de UI (0006_fase_ui_cadastro_cliente.sql) ----------------

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  municipalRegistration?: string;

  // Decide se `document` é CNPJ ou CPF (validação de formato fica a cargo do
  // frontend/UI — o backend só guarda o texto, igual já fazia com `document`).
  @IsOptional()
  @IsIn(['juridica', 'fisica'])
  personType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subsegment?: string;

  // Sem CHECK no banco (ver migration) — validado aqui só para consistência
  // com as opções que a UI oferece hoje; pode virar mais permissivo no
  // futuro sem migration.
  @IsOptional()
  @IsIn(['micro', 'pequena', 'media', 'grande'])
  companySize?: string;

  @IsOptional()
  @IsIn([
    'indicacao',
    'site',
    'evento',
    'prospeccao_ativa',
    'midia_paga',
    'outro',
  ])
  leadSource?: string;

  @IsOptional()
  @IsBoolean()
  isStrategicAccount?: boolean;

  // Só tem efeito para quem NÃO é vendedor — vendedor sempre vira dono do
  // que cria (ver common/crm/ownership.ts).
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
