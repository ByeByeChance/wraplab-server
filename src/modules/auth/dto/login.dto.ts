import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;
}
