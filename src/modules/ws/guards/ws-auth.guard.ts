import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  user: {
    sub: number;
    store_id: number;
    role: string;
    phone: string;
    token_version: number;
  };
  configId: number;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    const token = client.handshake.query.token as string;

    if (!token) {
      client.emit('ERROR', { message: 'Unauthorized: missing token', code: 1000, timestamp: Date.now() });
      client.disconnect();
      return false;
    }

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      (client as AuthenticatedSocket).user = payload;
      return true;
    } catch {
      client.emit('ERROR', { message: 'Unauthorized: invalid token', code: 1002, timestamp: Date.now() });
      client.disconnect();
      return false;
    }
  }
}
