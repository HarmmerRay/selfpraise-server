import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AdminMetricsController } from './metrics/admin-metrics.controller';
import { AdminMetricsService } from './metrics/admin-metrics.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminSessionsController } from './sessions/admin-sessions.controller';
import { AdminSessionsService } from './sessions/admin-sessions.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('admin.jwtSecret') ||
          'selfpraise-admin-dev-secret',
        signOptions: {
          expiresIn: config.get<number>('admin.expiresInSeconds') ?? 28800,
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminMetricsController,
    AdminUsersController,
    AdminSessionsController,
  ],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminDashboardService,
    AdminMetricsService,
    AdminUsersService,
    AdminSessionsService,
  ],
})
export class AdminModule {}
