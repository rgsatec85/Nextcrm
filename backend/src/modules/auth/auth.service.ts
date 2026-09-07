import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
    // Login precisa localizar o usuário por email ANTES de sabermos o
    // tenant, então usa o client com BYPASSRLS — assim como o signup.
    private readonly prismaAdmin: PrismaAdminService,
    private readonly prisma: PrismaService,
  ) {}

  async signup(dto: SignupDto) {
    const passwordHash = await argon2.hash(dto.adminPassword, {
      type: argon2.argon2id,
    });

    const { company, adminUser, adminRole } =
      await this.tenantsService.createTenantWithAdmin(
        dto.companyName,
        dto.cnpj,
        { name: dto.adminName, email: dto.adminEmail, passwordHash },
      );

    const token = this.issueToken({
      sub: adminUser.id,
      tenantId: company.id,
      email: adminUser.email,
      roleSlug: adminRole.slug,
    });

    return {
      accessToken: token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminRole.slug,
      },
      company: { id: company.id, name: company.name },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prismaAdmin.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    // Mesma mensagem de erro para "não existe" e "senha errada": evita
    // user enumeration (OWASP ASVS 5.0).
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    const token = this.issueToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roleSlug: user.role.slug,
      // Fase 3: só usuários cliente_portal têm customer_id preenchido — os
      // demais perfis nunca carregam este campo no token.
      ...(user.customerId ? { customerId: user.customerId as string } : {}),
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.slug,
      },
    };
  }

  async me(authUser: AuthenticatedUser) {
    return this.prisma.runWithTenant(authUser.tenantId, (tx) =>
      tx.user.findUnique({
        where: { id: authUser.sub },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          role: { select: { slug: true, name: true } },
          company: { select: { id: true, name: true } },
        },
      }),
    );
  }

  private issueToken(payload: AuthenticatedUser): string {
    return this.jwtService.sign(payload);
  }
}
