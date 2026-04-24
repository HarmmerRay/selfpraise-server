import { IsOptional, IsString } from 'class-validator';

export class GeneratePraiseDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

export class PraiseResponseDto {
  id: string;
  userId: string;
  content: string;
  audioPath: string | null;
  status: 'pending' | 'generated' | 'synthesized';
  createdAt: Date;
  updatedAt: Date;
}
