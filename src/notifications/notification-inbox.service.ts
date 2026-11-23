import { Injectable } from '@nestjs/common';
import { Notification, toNotification } from './notification';
import { NotificationRepository } from './notification.repository';

export interface MarkReadResult {
  updated: number;
  ids: string[];
}

@Injectable()
export class NotificationInboxService {
  constructor(private readonly notifications: NotificationRepository) {}

  async unread(userId: string, limit: number, before?: string): Promise<Notification[]> {
    const page = await this.notifications.findUnread(userId, limit, before);

    return page.map(toNotification);
  }

  async markRead(userId: string, ids: string[]): Promise<MarkReadResult> {
    const unread = await this.notifications.findUnreadIds(userId, ids);
    if (unread.length === 0) {
      return { updated: 0, ids: [] };
    }

    const updated = await this.notifications.markRead(userId, unread);

    return { updated, ids: unread };
  }
}
