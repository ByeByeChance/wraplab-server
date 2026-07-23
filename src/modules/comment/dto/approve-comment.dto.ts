import { IsEnum } from 'class-validator';

export class ApproveCommentDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';
}
