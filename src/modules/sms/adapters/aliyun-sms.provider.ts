import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider, SendSmsOptions } from '../interfaces/sms-provider.interface';

@Injectable()
export class AliyunSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(AliyunSmsProvider.name);

  async send(options: SendSmsOptions): Promise<void> {
    const templateCode = process.env.SMS_TEMPLATE_CODE || '';
    const signName = process.env.SMS_SIGN_NAME || 'WrapLab';

    this.logger.log(
      `[AliyunSMS] Sending verification code to ${options.phone} type=${options.type} code=${options.code} template=${templateCode} sign=${signName}`,
    );

    // TODO: Integrate with Alibaba Cloud SMS SDK (Dysmsapi)
    // const client = new DysmsapiClient({
    //   accessKeyId: process.env.SMS_ACCESS_KEY_ID,
    //   accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
    // });
    // await client.sendSms({
    //   PhoneNumbers: options.phone,
    //   SignName: signName,
    //   TemplateCode: templateCode,
    //   TemplateParam: JSON.stringify({ code: options.code }),
    // });
  }
}
