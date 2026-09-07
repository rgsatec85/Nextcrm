import { Module } from '@nestjs/common';
import { ProposalTemplatesService } from './proposal-templates.service';
import { ProposalTemplatesController } from './proposal-templates.controller';

@Module({
  controllers: [ProposalTemplatesController],
  providers: [ProposalTemplatesService],
})
export class ProposalTemplatesModule {}
