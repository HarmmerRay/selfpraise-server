import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateMemoDto {
  @IsString()
  title: string;

  @IsString()
  content: string;
}

export class MemoResponseDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DeleteMemoDto {
  @IsUUID()
  id: string;
}
