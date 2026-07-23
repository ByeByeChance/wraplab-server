import { IsEnum } from 'class-validator';

export class ShareDto {
  @IsEnum(['wechat_friend', 'wechat_moment'])
  platform: 'wechat_friend' | 'wechat_moment';
}
