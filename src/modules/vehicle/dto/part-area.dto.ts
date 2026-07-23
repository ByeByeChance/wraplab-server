import { IsArray, IsString, IsNumber, Min, Max, MaxLength, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PartAreaItem {
  @IsString()
  @MaxLength(20)
  part_code: string;

  @IsNumber()
  @Min(0)
  @Max(99.99)
  area_m2: number;
}

export class BatchUpdatePartAreaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartAreaItem)
  parts: PartAreaItem[];
}

export class CopyPartAreaDto {
  @IsNumber()
  @Min(1)
  templateModelId: number;
}
