import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class MessageRepository {
  constructor(@InjectModel(Message.name) private readonly model: Model<Message>) {}

  async create(roomId: string, userId: string, text: string): Promise<MessageDocument> {
    return await this.model.create({ roomId, userId, text, sentAt: new Date() });
  }

  async findPage(roomId: string, limit: number, before?: string): Promise<MessageDocument[]> {
    const filter: FilterQuery<Message> = { roomId };
    if (before) {
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    return await this.model.find(filter).sort({ _id: -1 }).limit(limit).exec();
  }
}
