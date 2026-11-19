import { Injectable } from '@nestjs/common';
import { MessageRepository } from './message.repository';
import { MessageResponse, toMessageResponse } from './message-response';

@Injectable()
export class MessageService {
  constructor(private readonly messages: MessageRepository) {}

  async save(roomId: string, userId: string, text: string): Promise<MessageResponse> {
    return toMessageResponse(await this.messages.create(roomId, userId, text));
  }

  async history(roomId: string, limit: number, before?: string): Promise<MessageResponse[]> {
    const page = await this.messages.findPage(roomId, limit, before);

    return page.map(toMessageResponse);
  }
}
