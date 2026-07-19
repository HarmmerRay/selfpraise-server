import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ShutdownService } from './shutdown.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly shutdown: ShutdownService,
  ) {}

  @Get()
  async root() {
    return this.ready();
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    if (this.shutdown.isShuttingDown) {
      throw new ServiceUnavailableException({ status: 'shutting_down' });
    }
    await this.redis.ping();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
