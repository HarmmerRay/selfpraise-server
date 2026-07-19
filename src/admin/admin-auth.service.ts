import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminAuthService {
  private readonly username: string;
  private readonly password: string;
  private readonly jwtSecret: string;
  private readonly expiresInSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.username = config.get<string>('admin.username') || 'admin';
    this.password = config.get<string>('admin.password') || 'admin123';
    this.jwtSecret =
      config.get<string>('admin.jwtSecret') || 'selfpraise-admin-dev-secret';
    this.expiresInSeconds =
      config.get<number>('admin.expiresInSeconds') ?? 60 * 60 * 8;
  }

  login(username: string, password: string) {
    if (username !== this.username || password !== this.password) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const accessToken = this.jwtService.sign(
      { sub: 'admin', type: 'admin' },
      {
        secret: this.jwtSecret,
        expiresIn: this.expiresInSeconds,
      },
    );
    return {
      accessToken,
      expiresIn: this.expiresInSeconds,
    };
  }
}
