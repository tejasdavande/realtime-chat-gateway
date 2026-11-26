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
import { OnlineUsersDto } from './dto/online-users.dto';
import { RoomHistoryDto } from './dto/room-history.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageRateLimitService } from './message-rate-limit.service';
import { PresenceService } from './presence.service';
import { RoomAccessService } from './room-access.service';
import { roomName, userRoom } from './room-name';

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
    private readonly presence: PresenceService,
    private readonly messages: MessageService,
    private readonly rateLimit: MessageRateLimitService
  ) {}

  afterInit(server: ChatServer) {
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
  }

  handleConnection(socket: ChatSocket) {
    this.logger.log(`connected userId=${socket.data.user.userId} socketId=${socket.id}`);
    socket.on('disconnecting', () => this.announceDeparture(socket));
  }

  private announceDeparture(socket: ChatSocket) {
    for (const room of [...socket.rooms]) {
      if (room.startsWith('room:')) {
        void this.announce(socket, room.slice('room:'.length), 'presence:left');
      }
    }
  }

  handleDisconnect(socket: ChatSocket) {
    this.logger.log(`disconnected userId=${socket.data.user?.userId} socketId=${socket.id}`);
  }

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    if (!this.roomAccess.canJoin(socket.data.user, dto.roomId)) {
      throw new WsException('forbidden');
    }

    const room = roomName(dto.roomId);
    const alreadyIn = socket.rooms.has(room);
    await socket.join(room);

    if (!alreadyIn) {
      void this.announce(socket, dto.roomId, 'presence:joined');
    }

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    const room = roomName(dto.roomId);
    const wasIn = socket.rooms.has(room);
    await socket.leave(room);

    if (wasIn) {
      void this.announce(socket, dto.roomId, 'presence:left');
    }

    return { roomId: dto.roomId };
  }

  @SubscribeMessage('room:members')
  async members(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: JoinRoomDto) {
    if (!socket.rooms.has(roomName(dto.roomId))) {
      throw new WsException('not in room');
    }

    try {
      return { roomId: dto.roomId, userIds: await this.presence.members(this.server, dto.roomId) };
    } catch (error) {
      this.logger.warn(`could not list members of room ${dto.roomId}: ${errorReason(error)}`);
      throw new WsException('could not list members');
    }
  }

  @SubscribeMessage('users:online')
  async onlineUsers(@MessageBody() dto: OnlineUsersDto) {
    try {
      return { online: await this.presence.online(this.server, dto.userIds) };
    } catch (error) {
      this.logger.warn(`could not check online users: ${errorReason(error)}`);
      throw new WsException('could not check online users');
    }
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

    if (!(await this.rateLimit.tryConsume(socket.data.user.userId))) {
      throw new WsException('rate limited');
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

  private async announce(
    socket: ChatSocket,
    roomId: string,
    event: 'presence:joined' | 'presence:left'
  ) {
    const userId = socket.data.user.userId;

    try {
      if (await this.presence.hasOtherSocket(this.server, roomId, userId, socket.id)) {
        return;
      }

      socket.to(roomName(roomId)).emit(event, { roomId, userId });
    } catch (error) {
      this.logger.warn(`could not announce ${event} for room ${roomId}: ${errorReason(error)}`);
    }
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

    await socket.join(userRoom(socket.data.user.userId));
    next();
  }
}
