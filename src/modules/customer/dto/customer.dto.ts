import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpsertCustomerDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  source?: string;
}
