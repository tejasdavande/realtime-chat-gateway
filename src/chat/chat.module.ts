import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatGateway } from './chat.gateway';
import { RoomAccessService } from './room-access.service';

@Module({
  imports: [AuthModule, MessagesModule],
  providers: [ChatGateway, RoomAccessService],
})
export class ChatModule {}
