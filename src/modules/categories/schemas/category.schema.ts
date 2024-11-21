import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

import { Collections, TopicTypes } from '../../../common/enums';
import { UserActionHistoryRecord } from '../../../common/schemas/user-action-history-record.schema';
import { CategoryPermissionsSchema } from './category-permissions.schema';

@Schema({
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
})
export class Category {
  @Prop({ required: true, type: mongoose.Schema.Types.Long })
  location: bigint;

  @Prop({ type: Types.ObjectId, ref: Collections.CATEGORIES })
  parent: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Collections.USERS, required: true })
  owner: Types.ObjectId;

  @Prop({ trim: true, required: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ type: [String], enum: TopicTypes, required: true })
  allowedTopicTypes: TopicTypes[];

  @Prop({ type: CategoryPermissionsSchema })
  permissions: CategoryPermissionsSchema;

  @Prop({
    type: [Types.ObjectId],
    ref: Collections.USERS,
    default: [],
  })
  subscribedUsers: Types.ObjectId[];

  // NOT IMPLEMENTED
  //@Prop({})
  //previousEdit?: Types.ObjectId;

  @Prop({ default: [] })
  pinHistory: Types.DocumentArray<UserActionHistoryRecord>;

  @Prop({ default: [] })
  deleteHistory: Types.DocumentArray<UserActionHistoryRecord>;

  @Prop({ default: false })
  isDeleted: boolean;

  isPinned: boolean;
}

export type CategoryDocument = HydratedDocument<Category>;

const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.virtual('isPinned').get(function () {
  return !!(this.pinHistory.length % 2);
});

CategorySchema.pre('save', function (next) {
  if (this.deleteHistory && this.deleteHistory.length) {
    this.isDeleted = !!(this.deleteHistory.length % 2);
  }

  next();
});

CategorySchema.index(
  { location: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

CategorySchema.index(
  { location: 1 },
  { partialFilterExpression: { isDeleted: true } },
);

CategorySchema.index({ owner: 1 });
CategorySchema.index({ title: 'text' });

export { CategorySchema };
