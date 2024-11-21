import { Types } from 'mongoose';
import { Prop, Schema } from '@nestjs/mongoose';
import { Collections, UsernameColors } from '../../../common/enums';

@Schema({ _id: false, versionKey: false })
export class UsernameColor {
  @Prop({ ref: Collections.USERS, required: true })
  addedBy: Types.ObjectId;

  @Prop({ enum: UsernameColors, required: true })
  color: UsernameColors;

  @Prop({ type: Boolean, default: false })
  selected: boolean;

  @Prop({ ref: Collections.USERS })
  removedBy?: Types.ObjectId;

  @Prop({ type: Date })
  removedTimestamp?: Date;
}
