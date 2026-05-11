import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collections } from '../../../common/enums';

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: Collections.TASKS, required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  userId: Types.ObjectId;

  @Prop({ trim: true, required: true, maxlength: 2000 })
  text: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export type CommentDocument = HydratedDocument<Comment>;
const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ taskId: 1, createdAt: 1 });

export { CommentSchema };
