import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  // Exportado a partir da Fase 4: AiService usa customerScore() (Fase 2)
  // como um dos sinais de entrada do Score IA — ver AiService.scoreIa e
  // docs/fase4-ia-corporativa.md.
  exports: [FinanceService],
})
export class FinanceModule {}
