import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Collections } from '../enums';

@Schema({ _id: false, versionKey: false })
export class UserActionHistoryRecord {
  @Prop({ ref: Collections.USERS, required: true })
  userId: Types.ObjectId;

  @Prop({ default: Date.now })
  timestamp: Date;
}
