import { IsString, IsInt, IsOptional, Min, MinLength } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  staff_id?: number;
}

export class BindWechatDto {
  @IsString()
  @MinLength(1)
  code: string;
}
