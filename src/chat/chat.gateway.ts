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
import { MessageService } from '../messages/message.service';
import { errorReason } from '../common/error-reason';
import { ChatServer, ChatSocket } from './chat-socket';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomHistoryDto } from './dto/room-history.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RoomAccessService } from './room-access.service';
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

  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly roomAccess: RoomAccessService,
    private readonly messages: MessageService
  ) {}

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
    if (!this.roomAccess.canJoin(socket.data.user, dto.roomId)) {
      throw new WsException('forbidden');
    }

    await socket.join(roomName(dto.roomId));

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    await socket.leave(roomName(dto.roomId));

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('message:send')
  async sendMessage(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: SendMessageDto) {
    const room = roomName(dto.roomId);

    if (!socket.rooms.has(room)) {
      throw new WsException('not in room');
    }

    if (!this.roomAccess.canSend(socket.data.user, dto.roomId)) {
      throw new WsException('forbidden');
    }

    const message = await this.saveMessage(dto, socket.data.user.userId);
    this.server.to(room).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('room:history')
  async history(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: RoomHistoryDto) {
    if (!socket.rooms.has(roomName(dto.roomId))) {
      throw new WsException('not in room');
    }

    return await this.messages.history(dto.roomId, dto.limit, dto.before);
  }

  private async saveMessage(dto: SendMessageDto, userId: string) {
    try {
      return await this.messages.save(dto.roomId, userId, dto.text);
    } catch (error) {
      this.logger.error(`could not save message: ${errorReason(error)}`);
      throw new WsException('could not save message');
    }
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
