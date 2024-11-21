import { Types } from 'mongoose';
import { Prop, Schema } from '@nestjs/mongoose';
import { Collections, Badges } from '../../../common/enums';

@Schema({ _id: false, versionKey: false })
export class Badge {
  @Prop({ ref: Collections.USERS, required: true })
  addedBy: Types.ObjectId;

  @Prop({ enum: Badges, required: true })
  badge: Badges;

  @Prop({ type: Boolean, default: false })
  pinned: boolean;

  @Prop({ ref: Collections.USERS })
  removedBy?: Types.ObjectId;

  @Prop({ type: Date })
  removedTimestamp?: Date;
}
