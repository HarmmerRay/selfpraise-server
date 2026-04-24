import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async sendCode(phone: string): Promise<{ sent: boolean }> {
    // TODO: 调用短信服务发送验证码
    // 开发阶段可跳过实际发送，验证码固定为 123456
    console.log(`[DEV] 验证码已发送至 ${phone}: 123456`);
    return { sent: true };
  }

  async login(phone: string, code: string): Promise<AuthResponseDto> {
    // TODO: 验证验证码
    // 开发阶段固定验证码为 123456
    if (code !== '123456') {
      throw new Error('验证码错误');
    }

    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone },
      });
    }

    // TODO: 生成 JWT Token
    const accessToken = `dev-token-${user.id}`;

    return {
      accessToken,
      userId: user.id,
      phone: user.phone,
    };
  }
}
