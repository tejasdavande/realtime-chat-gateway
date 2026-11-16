import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { SocketAuthService } from '../auth/socket-auth.service';
import { ChatServer, ChatSocket } from './chat-socket';
import { JoinRoomDto } from './dto/join-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { roomName } from './room-name';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: () => new WsException('invalid payload'),
  })
)
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server: ChatServer;

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

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    await socket.join(roomName(dto.roomId));

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    await socket.leave(roomName(dto.roomId));

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('message:send')
  sendMessage(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: SendMessageDto) {
    const room = roomName(dto.roomId);

    if (!socket.rooms.has(room)) {
      throw new WsException('not in room');
    }

    const message = {
      roomId: dto.roomId,
      text: dto.text,
      userId: socket.data.user.userId,
      sentAt: new Date().toISOString(),
    };
    this.server.to(room).emit('message:new', message);

    return message;
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
