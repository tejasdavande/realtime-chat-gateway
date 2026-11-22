import { Injectable } from '@nestjs/common';
import { Notification, toNotification } from './notification';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationInboxService {
  constructor(private readonly notifications: NotificationRepository) {}

  async unread(userId: string, limit: number, before?: string): Promise<Notification[]> {
    const page = await this.notifications.findUnread(userId, limit, before);

    return page.map(toNotification);
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    return await this.notifications.markRead(userId, ids);
  }
}
