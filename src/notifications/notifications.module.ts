import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [ApiKeyGuard, NotificationGateway, NotificationService],
})
export class NotificationsModule {}
