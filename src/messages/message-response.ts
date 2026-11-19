import { MessageDocument } from './schemas/message.schema';

export interface MessageResponse {
  id: string;
  roomId: string;
  userId: string;
  text: string;
  sentAt: string;
}

export const toMessageResponse = (message: MessageDocument): MessageResponse => ({
  id: message.id,
  roomId: message.roomId,
  userId: message.userId,
  text: message.text,
  sentAt: message.sentAt.toISOString(),
});
