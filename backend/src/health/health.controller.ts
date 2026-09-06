import { Controller, Get } from '@nestjs/common';

// Endpoint de health check usado pelo Render (Auto Scaling / Zero Downtime
// dependem disso — spec §21) e por monitoramento externo.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
