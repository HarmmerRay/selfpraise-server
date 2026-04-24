import { IsString, Matches, Length } from 'class-validator';

export class SendCodeDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;
}

export class LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: '验证码必须是6位' })
  code: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  userId: string;
  phone: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class MeResponseDto {
  userId: string;
  phone: string;
}
