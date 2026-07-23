import { IsArray, ArrayMinSize, IsInt, Min, IsOptional, IsObject } from 'class-validator';

export class UpdateStaffStoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  store_ids: number[];

  @IsOptional()
  @IsObject()
  roles?: Record<number, 'staff' | 'manager'>;
}
