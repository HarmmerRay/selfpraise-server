import { Body, Controller, Post } from '@nestjs/common';
import { AdminLoginDto } from './admin-auth.dto';
import { AdminAuthService } from './admin-auth.service';

@Controller('api/v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() body: AdminLoginDto) {
    return this.auth.login(body.username, body.password);
  }
}
