import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// @Global() pelo mesmo motivo do PrismaModule: RedisService é consumido por
// módulos independentes (AppModule para o throttler storage, HealthModule
// para a checagem de prontidão) sem que cada um precise reimportar o módulo.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
