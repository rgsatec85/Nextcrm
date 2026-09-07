import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { PortalLoginsService } from './portal-logins.service';
import { PortalLoginsController } from './portal-logins.controller';

@Module({
  controllers: [CustomersController, PortalLoginsController],
  providers: [CustomersService, PortalLoginsService],
  exports: [CustomersService],
})
export class CustomersModule {}
