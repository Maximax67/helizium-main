import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collections, TopicPermissions } from '../../../common/enums';

@Schema({ timestamps: true })
export class UserTopicPermissions {
  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  setBy: Types.ObjectId;

  @Prop({ required: true }) // TODO: ADD REF
  topicId: Types.ObjectId;

  @Prop({ type: [String], enum: TopicPermissions })
  granted?: TopicPermissions[];

  @Prop({ type: [String], enum: TopicPermissions })
  revoked?: TopicPermissions[];

  @Prop({ type: Types.ObjectId, ref: Collections.USERS })
  revokedBy?: Types.ObjectId;

  // NOT IMPLEMENTED
  //@Prop()
  //previousChange?: Types.ObjectId;
}

export type UserTopicPermissionsDocument =
  HydratedDocument<UserTopicPermissions>;

const UserTopicPermissionsSchema =
  SchemaFactory.createForClass(UserTopicPermissions);

UserTopicPermissionsSchema.index({ userId: 1 });
UserTopicPermissionsSchema.index({ topic: 1 });
UserTopicPermissionsSchema.index({ userId: 1, topic: 1 });

export { UserTopicPermissionsSchema };
