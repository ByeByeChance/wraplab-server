import { IsString, Matches, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(600)
  password: string;

  @IsOptional()
  @IsBoolean()
  encrypted?: boolean;
}
