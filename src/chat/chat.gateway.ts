import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { SocketAuthService } from '../auth/socket-auth.service';
import { ChatServer, ChatSocket } from './chat-socket';

@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly socketAuth: SocketAuthService) {}

  afterInit(server: ChatServer) {
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
  }

  handleConnection(socket: ChatSocket) {
    this.logger.log(`connected userId=${socket.data.user.userId} socketId=${socket.id}`);
  }

  handleDisconnect(socket: ChatSocket) {
    this.logger.log(`disconnected userId=${socket.data.user?.userId} socketId=${socket.id}`);
  }

  private async authenticate(socket: ChatSocket, next: (error?: Error) => void) {
    try {
      socket.data.user = await this.socketAuth.authenticate(socket.handshake.auth.token);
    } catch {
      next(new Error('unauthorized'));
      return;
    }

    next();
  }
}
