// Garante que testes unitários que instanciam PrismaClient diretamente
// (ex.: prisma.service.spec.ts) não quebrem por falta da env var —
// nenhum teste unitário depende de uma conexão real com o banco.
process.env.DATABASE_URL ??=
  'postgresql://app_user:app_user@localhost:5432/crm_enterprise_test?schema=public';
process.env.DATABASE_SERVICE_URL ??=
  'postgresql://app_service:app_service@localhost:5432/crm_enterprise_test?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
