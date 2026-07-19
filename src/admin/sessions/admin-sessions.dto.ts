import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminCreateSessionDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'voice', 'video'])
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  title?: string;
}

export class AdminUpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'voice', 'video'])
  channel?: string;

  /** true=归档，false=取消归档 */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
