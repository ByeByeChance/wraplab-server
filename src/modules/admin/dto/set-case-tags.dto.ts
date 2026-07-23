import { IsArray, IsInt, Min } from 'class-validator';

export class SetCaseTagsDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  tag_ids: number[];
}
