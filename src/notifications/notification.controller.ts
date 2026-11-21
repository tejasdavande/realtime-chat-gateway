import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { NotifyDto } from './dto/notify.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(ApiKeyGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  notify(@Body() dto: NotifyDto) {
    return { id: this.notifications.notify(dto).id };
  }
}
