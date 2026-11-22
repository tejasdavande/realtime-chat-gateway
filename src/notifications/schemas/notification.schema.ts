import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60;

@Schema({ collection: 'notifications', minimize: false })
export class UserNotification {
  @Prop({ required: true })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  notificationId: Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  data: Record<string, unknown>;

  @Prop({ required: true })
  sentAt: Date;

  @Prop({ type: Date, default: null })
  readAt: Date | null;
}

export type UserNotificationDocument = HydratedDocument<UserNotification>;

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);
UserNotificationSchema.index({ userId: 1, readAt: 1, notificationId: -1 });
UserNotificationSchema.index({ sentAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_SECONDS });
