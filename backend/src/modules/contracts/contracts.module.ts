import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ContractPdfService } from './contract-pdf.service';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractPdfService],
  // Exportado a partir da Fase 4: AiService usa o histórico de renovação de
  // contratos (status 'renovado' vs. total) como um dos sinais do Score IA.
  exports: [ContractsService],
})
export class ContractsModule {}
