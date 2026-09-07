// Precisa ser o primeiro import do arquivo — ver comentário em
// `observability/tracing.ts` sobre por que a SDK do OTel tem que iniciar
// antes de qualquer módulo (Nest, Express, pg via Prisma) ser carregado.
import { initTracing } from './observability/tracing';
initTracing();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown (Fase 5): faz o Nest chamar OnModuleDestroy de todos
  // os providers (PrismaService, PrismaAdminService, RedisService) ao
  // receber SIGTERM/SIGINT — essencial para o zero-downtime deploy do
  // Render (o processo antigo tem uma chance de fechar conexões de banco/
  // Redis em vez de ser morto a força) e para não deixar transações do
  // Prisma penduradas em CI.
  app.enableShutdownHooks();

  // Segurança básica de headers (CSP, HSTS, etc. — spec seção 17)
  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
    credentials: true,
  });

  // Nunca confia em payload sem validar/whitelistar campos (mitigação de
  // mass assignment e XSS/SQLi indireto via DTOs não tipados).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CRM backend rodando em http://localhost:${port}/api`);
}

bootstrap();
