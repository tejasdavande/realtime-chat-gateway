import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageRepository } from './message.repository';
import { MessageService } from './message.service';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }])],
  providers: [MessageRepository, MessageService],
  exports: [MessageService],
})
export class MessagesModule {}
