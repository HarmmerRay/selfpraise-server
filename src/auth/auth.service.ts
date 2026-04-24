import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthResponseDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

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

    // 验证通过后删除验证码
    await this.redis.del(key);

    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone },
      });
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
    });

    return {
      accessToken,
      userId: user.id,
      phone: user.phone,
    };
  }
}
