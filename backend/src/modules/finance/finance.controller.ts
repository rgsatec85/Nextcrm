import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // Visão consolidada da empresa — não faz sentido para "vendedor".
  @Get('dashboard')
  @Roles('admin', 'gestor', 'financeiro')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.dashboard(user);
  }

  @Get('customers/:id/score')
  customerScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeService.customerScore(user, id);
  }

  @Get('commissions')
  commissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.financeService.commissionsReport(user, ownerId);
  }
}
