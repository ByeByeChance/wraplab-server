export interface SendSmsOptions {
  phone: string;
  code: string;
  type: 'login' | 'verify' | 'appointment';
}

export interface ISmsProvider {
  send(options: SendSmsOptions): Promise<void>;
}
