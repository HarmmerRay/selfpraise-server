import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEpisodeDto {
  @IsString()
  @MaxLength(240)
  title!: string;

  @IsString()
  @MaxLength(10000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  emotionTag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  importanceScore?: number;

  @IsOptional()
  @IsUUID()
  sourceSessionId?: string;
}

export class EpisodeResponseDto {
  id!: string;
  userId!: string;
  title!: string;
  content!: string;
  emotionTag!: string | null;
  importanceScore!: number;
  occurredAt!: Date;
  sourceSessionId!: string | null;
  createdAt!: Date;
}
