import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collections } from '../../../common/enums';

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true, index: true })
  from: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true, index: true })
  to: Types.ObjectId;

  @Prop({ trim: true, required: true, maxlength: 2000 })
  message: string;

  @Prop({ type: Date, default: null })
  readAt: Date | null;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ from: 1, to: 1, createdAt: -1 });
ChatMessageSchema.index({ to: 1, readAt: 1 });

export { ChatMessageSchema };
