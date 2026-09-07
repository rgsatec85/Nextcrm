import { Module } from '@nestjs/common';
import { AgendaBlocksService } from './agenda-blocks.service';
import { AgendaBlocksController } from './agenda-blocks.controller';

@Module({
  controllers: [AgendaBlocksController],
  providers: [AgendaBlocksService],
})
export class AgendaBlocksModule {}
