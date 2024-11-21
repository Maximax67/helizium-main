import { Types } from 'mongoose';
import { Prop, Schema } from '@nestjs/mongoose';

import { UserContactTypes } from '../enums';
import { Collections } from '../../../common/enums';

@Schema({ _id: false, versionKey: false })
export class UserContact {
  // POST type: phone, data: +380....,
  // DELTE
  // PUT
  @Prop({ enum: UserContactTypes, required: true })
  type: UserContactTypes;

  @Prop({ trim: true })
  data: string;

  @Prop({ ref: Collections.USERS })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedTimestamp?: Date;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}
