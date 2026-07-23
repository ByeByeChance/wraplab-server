import { IsString, IsOptional, Matches, MinLength, MaxLength, IsIn } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @IsIn(['staff', 'manager'], { message: '角色只能为 staff 或 manager' })
  role: 'staff' | 'manager';

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['staff', 'manager'], { message: '角色只能为 staff 或 manager' })
  role?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'disabled'])
  status?: string;
}
