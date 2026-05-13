import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collections } from '../../../common/enums';

export enum TaskStatus {
  SEARCHING = 'searching',
  IN_PROGRESS = 'in_progress',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } })
export class Task {
  @Prop({ type: Types.ObjectId, ref: Collections.CATEGORIES, required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  authorId: Types.ObjectId;

  @Prop({ trim: true, required: true, maxlength: 200 })
  title: string;

  @Prop({ trim: true, required: true, maxlength: 5000 })
  content: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ enum: ['ETH', 'USD'], default: 'ETH' })
  currency: string;

  @Prop({ type: [Types.ObjectId], ref: Collections.USERS, default: [] })
  applicants: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: Collections.USERS, default: [] })
  rejectedApplicants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, default: null })
  performerId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  workResult: string | null;

  @Prop({ default: false })
  completed: boolean;

  @Prop({ enum: Object.values(TaskStatus), default: TaskStatus.SEARCHING })
  status: TaskStatus;

  @Prop({ type: String, default: null })
  rejectionMessage: string | null;

  /** Ethereum transaction hash of the most recent relevant on-chain operation. */
  @Prop({ type: String, default: null })
  contractTxHash: string | null;

  @Prop({ type: Number, default: null, min: 1, max: 5 })
  performerRating: number | null;

  /** Who raised the dispute. */
  @Prop({ type: Types.ObjectId, ref: Collections.USERS, default: null })
  disputeRaisedBy: Types.ObjectId | null;

  @Prop({ default: false })
  isDeleted: boolean;
}

export type TaskDocument = HydratedDocument<Task>;

const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ authorId: 1 });
TaskSchema.index({ categoryId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ isDeleted: 1 });
TaskSchema.index({ performerId: 1 });
TaskSchema.index({ title: 'text', content: 'text' });
TaskSchema.index({ price: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ createdAt: -1 });

export { TaskSchema };
