import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator';
import type { JsonValue } from '@prisma/client/runtime/library';

/** 会话渠道：voice / video / text */
export class StartSessionDto {
  @IsString()
  channel!: string;
}

export class AppendMessageDto {
  @IsString()
  role!: string;

  @IsString()
  @MaxLength(50000)
  content!: string;

  @IsOptional()
  @IsObject()
  intentJson?: Record<string, unknown>;
}

export class EndSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string;
}

export class SessionResponseDto {
  id!: string;
  userId!: string;
  channel!: string;
  summary!: string | null;
  startedAt!: Date;
  endedAt!: Date | null;
}

export class MessageResponseDto {
  id!: string;
  sessionId!: string;
  role!: string;
  content!: string;
  /** UiIntent / JSON 载荷 */
  intentJson!: JsonValue | null;
  createdAt!: Date;
}
