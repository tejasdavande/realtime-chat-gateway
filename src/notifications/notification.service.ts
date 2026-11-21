import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotifyDto } from './dto/notify.dto';
import { Notification } from './notification';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(private readonly gateway: NotificationGateway) {}

  notify(dto: NotifyDto): Notification {
    const notification: Notification = {
      id: randomUUID(),
      type: dto.type,
      data: dto.data ?? {},
      sentAt: new Date().toISOString(),
    };

    this.gateway.deliver(dto.userIds, notification);

    return notification;
  }
}
