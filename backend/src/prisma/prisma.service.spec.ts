import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

// Estes testes instanciam um PrismaClient de verdade (sem conectar). Isso
// exige que `prisma generate` já tenha rodado (ver package.json > "prisma:generate").
// Se o client ainda não foi gerado — por exemplo, num ambiente sem acesso à
// binaries.prisma.sh para baixar o engine — o pacote expõe um stub cujo
// construtor lança "did not initialize yet". Detectamos isso aqui para dar
// um skip com mensagem clara em vez de um erro confuso de CI.
let prismaGenerated = true;
try {
  new PrismaClient();
} catch {
  prismaGenerated = false;
}

const maybeDescribe = prismaGenerated ? describe : describe.skip;

if (!prismaGenerated) {
  // eslint-disable-next-line no-console
  console.warn(
    '[prisma.service.spec] pulado: rode "npm run prisma:generate" (requer acesso à internet para baixar o query engine).',
  );
}

maybeDescribe('PrismaService.runWithTenant', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService();
  });

  it('rejeita tenantId que não é um UUID (defesa contra SQL injection via SET LOCAL)', async () => {
    await expect(
      prisma.runWithTenant("' OR '1'='1", async () => null),
    ).rejects.toThrow('tenantId inválido');
  });

  it('rejeita tenantId vazio', async () => {
    await expect(prisma.runWithTenant('', async () => null)).rejects.toThrow(
      'tenantId inválido',
    );
  });

  it('aceita um UUID válido e passa da validação de formato', async () => {
    // Não há banco disponível neste teste unitário — o objetivo aqui é só
    // garantir que um tenantId válido passa da validação de formato e cai
    // na tentativa de $transaction (que falha por falta de conexão real,
    // não por "tenantId inválido").
    const validUuid = '123e4567-e89b-42d3-a456-426614174000';
    let error: Error | undefined;
    try {
      await prisma.runWithTenant(validUuid, async () => null);
    } catch (err) {
      error = err as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).not.toMatch('tenantId inválido');
  });
});
