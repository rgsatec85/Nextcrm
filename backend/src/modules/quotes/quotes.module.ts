import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [OpportunitiesModule, WebhooksModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
