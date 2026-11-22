import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKeyGuard } from './api-key.guard';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { UserNotification, UserNotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserNotification.name, schema: UserNotificationSchema }]),
  ],
  controllers: [NotificationController],
  providers: [ApiKeyGuard, NotificationGateway, NotificationRepository, NotificationService],
})
export class NotificationsModule {}
