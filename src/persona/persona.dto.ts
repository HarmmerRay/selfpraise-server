import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class PersonaResponseDto {
  id!: string;
  userId!: string;
  traits!: Record<string, unknown>;
  confidenceScore!: number;
  onboardingCompletedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PatchPersonaDto {
  @IsOptional()
  @IsObject()
  traits?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  confidenceScore?: number;

  /** 完成注册后初见流程 */
  @IsOptional()
  @IsBoolean()
  completeOnboarding?: boolean;
}
