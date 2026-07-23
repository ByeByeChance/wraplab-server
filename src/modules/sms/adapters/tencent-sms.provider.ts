import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider, SendSmsOptions } from '../interfaces/sms-provider.interface';

@Injectable()
export class TencentSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(TencentSmsProvider.name);

  async send(options: SendSmsOptions): Promise<void> {
    const templateCode = process.env.SMS_TEMPLATE_CODE || '';
    const signName = process.env.SMS_SIGN_NAME || 'WrapLab';

    this.logger.log(
      `[TencentSMS] Sending verification code to ${options.phone} type=${options.type} code=${options.code} template=${templateCode} sign=${signName}`,
    );

    // TODO: Integrate with Tencent Cloud SMS SDK
    // const client = new SmsClient({
    //   credential: {
    //     secretId: process.env.SMS_ACCESS_KEY_ID,
    //     secretKey: process.env.SMS_ACCESS_KEY_SECRET,
    //   },
    // });
    // await client.SendSms({
    //   PhoneNumberSet: [options.phone],
    //   SignName: signName,
    //   TemplateId: templateCode,
    //   TemplateParamSet: [options.code],
    // });
  }
}
