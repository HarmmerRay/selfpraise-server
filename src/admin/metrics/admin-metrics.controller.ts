import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminMetricsService } from './admin-metrics.service';

@Controller('api/v1/admin/metrics')
@UseGuards(AdminJwtGuard)
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @Get('tokens')
  tokens(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy')
    groupBy?: 'day' | 'hour' | 'minute' | 'purpose' | 'user',
  ) {
    return this.metrics.tokens({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      groupBy,
    });
  }
}
