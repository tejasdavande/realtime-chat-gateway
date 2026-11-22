import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Notification } from './notification';
import { UserNotification, UserNotificationDocument } from './schemas/notification.schema';

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

  async findUnread(
    userId: string,
    limit: number,
    before?: string
  ): Promise<UserNotificationDocument[]> {
    const filter: FilterQuery<UserNotification> = { userId, readAt: null };
    if (before) {
      filter.notificationId = { $lt: new Types.ObjectId(before) };
    }

    return await this.model.find(filter).sort({ notificationId: -1 }).limit(limit).exec();
  }

  async markRead(userId: string, notificationIds: string[]): Promise<number> {
    const result = await this.model.updateMany(
      {
        userId,
        notificationId: { $in: notificationIds.map((id) => new Types.ObjectId(id)) },
        readAt: null,
      },
      { $set: { readAt: new Date() } }
    );

    return result.modifiedCount;
  }
}
