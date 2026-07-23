import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ConfigurationService } from '../configuration/configuration.service';
import { BusinessException } from '../../common/exceptions/business.exception';

interface JwtPayload {
  sub: number;
  store_id: number;
  role: string;
  phone: string;
  token_version: number;
}

interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
  configId: number;
}

interface SetColorPayload {
  color_swatch_id: number;
  material_id: number;
}

interface SetPartColorPayload {
  part_code: string;
  color_swatch_id: number;
  material_id: number;
}

interface SetMaterialPayload {
  material_id: number;
}

@WebSocketGateway({
  namespace: '/ws/3d-viewer',
  cors: { origin: '*' },
})
@UseGuards(WsAuthGuard)
export class ViewerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly configService: ConfigurationService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const configId = parseInt(client.handshake.query.configurationId as string, 10);

      if (!configId || isNaN(configId)) {
        client.emit('ERROR', { message: 'Missing configurationId', code: 2000, timestamp: Date.now() });
        client.disconnect();
        return;
      }

      // Validate configuration exists and belongs to store
      await this.configService.findById(configId);

      client.join(`config:${configId}`);
      (client as AuthenticatedSocket).configId = configId;

      client.emit('CONNECTED', { configurationId: configId, timestamp: Date.now() });
      client.emit('MODEL_READY', { configurationId: configId, timestamp: Date.now() });
    } catch (error) {
      client.emit('ERROR', {
        message: error instanceof Error ? error.message : 'Connection failed',
        code: 1000,
        timestamp: Date.now(),
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const configId = (client as AuthenticatedSocket).configId;
    if (configId) {
      client.leave(`config:${configId}`);
    }
  }

  @SubscribeMessage('SET_COLOR')
  async handleSetColor(
    client: Socket,
    data: { type: string; payload: SetColorPayload; timestamp: number },
  ): Promise<void> {
    try {
      const configId = (client as AuthenticatedSocket).configId;
      if (!configId) return;

      await this.configService.updatePartColor(
        configId,
        'FULL',
        data.payload.color_swatch_id,
        data.payload.material_id,
      );

      this.server.to(`config:${configId}`).emit('COLOR_APPLIED', {
        configuration_id: configId,
        color_swatch_id: data.payload.color_swatch_id,
        material_id: data.payload.material_id,
        timestamp: Date.now(),
      });
    } catch (error) {
      const err = error as Error;
      client.emit('ERROR', {
        message: err.message ?? String(error),
        code: error instanceof BusinessException ? error.code : 5000,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('SET_PART_COLOR')
  async handleSetPartColor(
    client: Socket,
    data: { type: string; payload: SetPartColorPayload; timestamp: number },
  ): Promise<void> {
    try {
      const configId = (client as AuthenticatedSocket).configId;
      if (!configId) return;

      await this.configService.updatePartColor(
        configId,
        data.payload.part_code,
        data.payload.color_swatch_id,
        data.payload.material_id,
      );

      this.server.to(`config:${configId}`).emit('PART_COLOR_APPLIED', {
        configuration_id: configId,
        part_code: data.payload.part_code,
        color_swatch_id: data.payload.color_swatch_id,
        material_id: data.payload.material_id,
        timestamp: Date.now(),
      });
    } catch (error) {
      const err = error as Error;
      client.emit('ERROR', {
        message: err.message ?? String(error),
        code: error instanceof BusinessException ? error.code : 5000,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('SET_MATERIAL')
  async handleSetMaterial(
    client: Socket,
    data: { type: string; payload: SetMaterialPayload; timestamp: number },
  ): Promise<void> {
    try {
      const configId = (client as AuthenticatedSocket).configId;
      if (!configId) return;

      await this.configService.updateAllPartMaterials(configId, data.payload.material_id);

      this.server.to(`config:${configId}`).emit('MATERIAL_APPLIED', {
        configuration_id: configId,
        material_id: data.payload.material_id,
        timestamp: Date.now(),
      });
    } catch (error) {
      const err = error as Error;
      client.emit('ERROR', {
        message: err.message ?? String(error),
        code: error instanceof BusinessException ? error.code : 5000,
        timestamp: Date.now(),
      });
    }
  }
}
