import { IsInt, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsInt()
  @Min(1)
  configuration_id: number;
}
