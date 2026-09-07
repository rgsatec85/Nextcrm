import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ContractsModule } from '../contracts/contracts.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { DeterministicAiProvider } from './providers/deterministic-ai.provider';
import { OllamaAiProvider } from './providers/ollama-ai.provider';

/**
 * Seleção de provider (spec Fase 4 — "preparação de infraestrutura para uso
 * com Ollama"): `AI_PROVIDER=deterministic` (default, único caminho
 * exercitado pelos testes deste projeto) ou `AI_PROVIDER=ollama` (real,
 * mas não alcançável neste sandbox — ver providers/ollama-ai.provider.ts).
 * Os dois providers concretos ficam registrados de qualquer forma (o
 * `OllamaAiProvider` tem seu próprio fallback interno para o determinístico
 * em caso de falha), e a factory abaixo é o único lugar que decide qual
 * implementação satisfaz o token `AI_PROVIDER` injetado em `AiService`.
 */
@Module({
  imports: [
    ConfigModule,
    CustomersModule,
    FinanceModule,
    OpportunitiesModule,
    ContractsModule,
    InvoicesModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    DeterministicAiProvider,
    OllamaAiProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (
        config: ConfigService,
        deterministic: DeterministicAiProvider,
        ollama: OllamaAiProvider,
      ) => {
        const selected = (
          config.get<string>('AI_PROVIDER') ?? 'deterministic'
        ).toLowerCase();
        return selected === 'ollama' ? ollama : deterministic;
      },
      inject: [ConfigService, DeterministicAiProvider, OllamaAiProvider],
    },
  ],
})
export class AiModule {}
