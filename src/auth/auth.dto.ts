import { IsString } from 'class-validator';

export class SendCodeDto {
  @IsString()
  phone: string;
}

export class LoginDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;
}

export class AuthResponseDto {
  accessToken: string;
  userId: string;
  phone: string;
}
