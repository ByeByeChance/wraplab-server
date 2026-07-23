import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ViewerGateway } from './viewer.gateway';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [JwtModule.register({}), ConfigurationModule],
  providers: [ViewerGateway, WsAuthGuard],
  exports: [ViewerGateway],
})
export class WsModule {}
