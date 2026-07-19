import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface AdminJwtPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('admin.jwtSecret') || 'selfpraise-admin-dev-secret',
    });
  }

  validate(payload: AdminJwtPayload) {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('需要管理员身份');
    }
    return { adminId: payload.sub, type: 'admin' };
  }
}
