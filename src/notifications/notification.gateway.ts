import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ChatServer, ChatSocket } from '../chat/chat-socket';
import { userRoom } from '../chat/room-name';
import { errorReason } from '../common/error-reason';
import { MarkReadDto } from './dto/mark-read.dto';
import { UnreadNotificationsDto } from './dto/unread-notifications.dto';
import { Notification } from './notification';
import { MarkReadResult, NotificationInboxService } from './notification-inbox.service';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: () => new WsException('invalid payload'),
  })
)
@WebSocketGateway()
export class NotificationGateway {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private readonly server: ChatServer;

  constructor(private readonly inbox: NotificationInboxService) {}

  deliver(userIds: string[], notification: Notification) {
    this.server.to(userIds.map(userRoom)).emit('notification', notification);
  }

  @SubscribeMessage('notification:unread')
  async unread(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: UnreadNotificationsDto) {
    try {
      return await this.inbox.unread(socket.data.user.userId, dto.limit, dto.before);
    } catch (error) {
      this.logger.warn(`could not load notifications: ${errorReason(error)}`);
      throw new WsException('could not load notifications');
    }
  }

  @SubscribeMessage('notification:read')
  async markRead(@ConnectedSocket() socket: ChatSocket, @MessageBody() dto: MarkReadDto) {
    const { userId } = socket.data.user;
    let result: MarkReadResult;
    try {
      result = await this.inbox.markRead(userId, dto.ids);
    } catch (error) {
      this.logger.warn(`could not mark notifications read: ${errorReason(error)}`);
      throw new WsException('could not mark notifications read');
    }

    if (result.updated > 0) {
      socket.to(userRoom(userId)).emit('notification:marked-read', { ids: result.ids });
    }

    return { updated: result.updated };
  }
}
