import { UserNotificationDocument } from './schemas/notification.schema';

export interface Notification {
  id: string;
  type: string;
  data: Record<string, unknown>;
  sentAt: string;
}

export const toNotification = (doc: UserNotificationDocument): Notification => ({
  id: doc.notificationId.toHexString(),
  type: doc.type,
  data: doc.data,
  sentAt: doc.sentAt.toISOString(),
});
