import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthResponseDto } from './auth.dto';
import { bid, snowflake } from '../common/id/snowflake';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiresInSeconds: number;
  private readonly refreshTokenExpiresInSeconds: number;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.accessTokenExpiresInSeconds =
      config.get<number>('jwt.accessExpiresInSeconds') ?? 1800;
    this.refreshTokenExpiresInSeconds =
      config.get<number>('jwt.refreshExpiresInSeconds') ?? 60 * 60 * 24 * 180;
    this.jwtSecret =
      config.get<string>('jwt.secret') || 'selfpraise-dev-secret';
    this.jwtRefreshSecret =
      config.get<string>('jwt.refreshSecret') || 'selfpraise-dev-refresh-secret';
  }

  async sendCode(phone: string): Promise<{ sent: boolean }> {
    const code = '123456'; // MVP: 固定验证码
    const key = `sms:${phone}`;

    await this.redis.set(key, code, 'EX', 300); // 5 分钟过期

    this.logger.log(`验证码已发送至 ${phone}: ${code}（开发模式）`);

    return { sent: true };
  }

  async login(phone: string, code: string): Promise<AuthResponseDto> {
    const key = `sms:${phone}`;
    const storedCode = await this.redis.get(key);

    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    await this.redis.del(key);

    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { id: snowflake.nextId(), phone },
      });
    }

    const userId = user.id.toString();
    const { accessToken, refreshToken } = await this.issueTokens(
      userId,
      user.phone,
    );

    return {
      accessToken,
      refreshToken,
      userId,
      phone: user.phone,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        phone: string;
        type: string;
      }>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的 refresh token');
      }

      const key = `refresh:${payload.sub}`;
      const storedToken = await this.redis.get(key);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('refresh token 已失效');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: bid(payload.sub) },
      });
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      const userId = user.id.toString();
      const tokens = await this.issueTokens(userId, user.phone);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId,
        phone: user.phone,
      };
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }
  }

  async me(userId: string): Promise<{ userId: string; phone: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: bid(userId) },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return { userId: user.id.toString(), phone: user.phone };
  }

  private async issueTokens(
    userId: string,
    phone: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { sub: userId, phone, type: 'access' },
      {
        secret: this.jwtSecret,
        expiresIn: this.accessTokenExpiresInSeconds,
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId, phone, type: 'refresh' },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.refreshTokenExpiresInSeconds,
      },
    );

    await this.redis.set(
      `refresh:${userId}`,
      refreshToken,
      'EX',
      this.refreshTokenExpiresInSeconds,
    );

    return { accessToken, refreshToken };
  }
}
