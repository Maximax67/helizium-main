import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Collections, GlobalPermissions } from '../../../common/enums';

@Schema({ _id: false, versionKey: false })
export class UserGlobalPermissions {
  @Prop({ type: Types.ObjectId, ref: Collections.USERS })
  setBy?: Types.ObjectId;

  @Prop({ type: [String], enum: GlobalPermissions, default: [] })
  permissions: GlobalPermissions[];

  @Prop({ type: Date })
  timestamp?: Date;

  // NOT IMPLEMENTED
  //@Prop()
  //previousChange?: Types.ObjectId;
}
