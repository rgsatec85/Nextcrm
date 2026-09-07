import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePortalLoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  // Mesma política de senha do signup (OWASP ASVS 5.0) — hashing com
  // Argon2id feito no service, nunca texto puro persistido.
  @IsString()
  @MinLength(12, { message: 'senha deve ter ao menos 12 caracteres' })
  @MaxLength(128)
  password: string;
}
