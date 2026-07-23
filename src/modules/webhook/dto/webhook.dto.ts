import { IsEnum, IsString, IsBoolean, IsArray, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateWebhookConfigDto {
  @IsEnum(['wecom', 'dingtalk'])
  type: 'wecom' | 'dingtalk';

  @IsString()
  @IsUrl({ protocols: ['https'] })
  @MaxLength(500)
  url: string;

  @IsBoolean()
  status: boolean;

  @IsArray()
  @IsEnum(
    [
      'customer.created',
      'customer.birthday',
      'customer.anniversary',
      'appointment.created',
      'appointment.confirmed',
      'quote.confirmed',
      'campaign.claimed',
    ],
    { each: true },
  )
  events: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  secret?: string;
}
