import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName: string;

  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'cnpj deve conter 14 dígitos numéricos (sem máscara)',
  })
  cnpj: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  adminName: string;

  @IsEmail()
  adminEmail: string;

  // Política de senha alinhada à OWASP ASVS 5.0 (mínimo 12 caracteres,
  // hashing com Argon2id feito no AuthService — nunca compare em texto puro).
  @IsString()
  @MinLength(12, { message: 'senha deve ter ao menos 12 caracteres' })
  @MaxLength(128)
  adminPassword: string;
}
