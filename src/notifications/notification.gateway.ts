import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChatServer } from '../chat/chat-socket';
import { userRoom } from '../chat/room-name';
import { Notification } from './notification';

@WebSocketGateway()
export class NotificationGateway {
  @WebSocketServer()
  private readonly server: ChatServer;

  deliver(userIds: string[], notification: Notification) {
    this.server.to(userIds.map(userRoom)).emit('notification', notification);
  }
}
