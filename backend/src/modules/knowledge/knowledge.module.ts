import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  // Exportado para o PortalModule chamar findPublished() diretamente.
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
