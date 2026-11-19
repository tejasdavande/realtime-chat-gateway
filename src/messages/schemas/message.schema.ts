import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'messages' })
export class Message {
  @Prop({ required: true })
  roomId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  sentAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ roomId: 1, _id: -1 });
