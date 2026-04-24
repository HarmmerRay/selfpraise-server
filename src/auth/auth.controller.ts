import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  SendCodeDto,
  LoginDto,
  AuthResponseDto,
  RefreshTokenDto,
  MeResponseDto,
} from './auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-code')
  async sendCode(@Body() dto: SendCodeDto): Promise<{ sent: boolean }> {
    return this.authService.sendCode(dto.phone);
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto.phone, dto.code);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<MeResponseDto> {
    return this.authService.me(req.user.userId);
  }
}
