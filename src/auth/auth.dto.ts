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
  userId: string;
  phone: string;
}
