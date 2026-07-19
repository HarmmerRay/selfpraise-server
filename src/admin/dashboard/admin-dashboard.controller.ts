import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('api/v1/admin/dashboard')
@UseGuards(AdminJwtGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('overview')
  overview() {
    return this.dashboard.overview();
  }
}
