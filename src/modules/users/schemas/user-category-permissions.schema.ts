import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  CategoryPermissions,
  Collections,
  TopicPermissions,
} from '../../../common/enums';

@Schema({ timestamps: true })
export class UserCategoryPermissions {
  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  setBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.CATEGORIES, required: true })
  categoryId: Types.ObjectId;

  // TODO Allow some of empty permissions fields to be not present for saving memory

  @Prop({ type: [String], enum: CategoryPermissions })
  categoriesGranted: CategoryPermissions[];

  @Prop({ type: [String], enum: CategoryPermissions })
  categoriesRevoked: CategoryPermissions[];

  @Prop({ type: [String], enum: TopicPermissions })
  topicsGranted: TopicPermissions[];

  @Prop({ type: [String], enum: TopicPermissions })
  topicsRevoked: TopicPermissions[];

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, default: null })
  revokedBy: Types.ObjectId | null;
}

export type UserCategoryPermissionsDocument =
  HydratedDocument<UserCategoryPermissions>;

const UserCategoryPermissionsSchema = SchemaFactory.createForClass(
  UserCategoryPermissions,
);

UserCategoryPermissionsSchema.index({ userId: 1 });
UserCategoryPermissionsSchema.index({ categoryId: 1 });
UserCategoryPermissionsSchema.index({ userId: 1, categoryId: 1 });

export { UserCategoryPermissionsSchema };
