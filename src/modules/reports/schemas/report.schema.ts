import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collections } from '../../../common/enums';

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: Collections.TASKS, required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  reporterId: Types.ObjectId;

  @Prop({ trim: true, required: true, maxlength: 1000 })
  reason: string;

  @Prop({ enum: ['pending', 'resolved', 'dismissed'], default: 'pending' })
  status: string;
}

export type ReportDocument = HydratedDocument<Report>;
const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ taskId: 1, reporterId: 1 });

export { ReportSchema };
