import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { errorReason } from '../common/error-reason';
import { NotifyDto } from './dto/notify.dto';
import { Notification } from './notification';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly gateway: NotificationGateway
  ) {}

  async notify(dto: NotifyDto): Promise<Notification> {
    const notification: Notification = {
      id: new Types.ObjectId().toHexString(),
      type: dto.type,
      data: dto.data ?? {},
      sentAt: new Date().toISOString(),
    };

    try {
      await this.notifications.createForUsers(dto.userIds, notification);
    } catch (error) {
      this.logger.error(`could not save notification: ${errorReason(error)}`);
      throw new ServiceUnavailableException('could not save notification');
    }

    this.gateway.deliver(dto.userIds, notification);

    return notification;
  }
}
