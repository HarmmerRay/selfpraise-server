import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

type JwtUser = { userId: string; phone: string };

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  },
);
