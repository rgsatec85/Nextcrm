import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { CustomersModule } from '../customers/customers.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({
  imports: [CustomersModule, OpportunitiesModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
