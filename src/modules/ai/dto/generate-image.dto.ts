import { IsEnum, IsOptional, IsString, IsInt, Min, MaxLength } from 'class-validator';

export class GenerateImageDto {
  @IsEnum(['scene', 'studio', 'outdoor'])
  style: 'scene' | 'studio' | 'outdoor';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  custom_prompt?: string;
}

export class AiCallbackDto {
  @IsInt()
  @Min(1)
  generation_id: number;

  @IsEnum(['completed', 'failed'])
  status: 'completed' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  result_image_url?: string;

  @IsOptional()
  @IsString()
  error_message?: string;
}
