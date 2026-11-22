import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './notification';
import { UserNotification } from './schemas/notification.schema';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(UserNotification.name) private readonly model: Model<UserNotification>
  ) {}

  async createForUsers(userIds: string[], notification: Notification): Promise<void> {
    await this.model.insertMany(
      userIds.map((userId) => ({
        userId,
        notificationId: notification.id,
        type: notification.type,
        data: notification.data,
        sentAt: new Date(notification.sentAt),
      }))
    );
  }
}
