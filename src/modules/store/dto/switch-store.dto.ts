import { IsInt, Min } from 'class-validator';

export class SwitchStoreDto {
  @IsInt()
  @Min(1)
  target_store_id: number;
}
