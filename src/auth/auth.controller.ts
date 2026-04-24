import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendCodeDto, LoginDto, AuthResponseDto } from './auth.dto';

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
}
