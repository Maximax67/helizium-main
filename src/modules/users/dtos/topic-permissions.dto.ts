import { Expose } from 'class-transformer';
import { Types } from 'mongoose';
import { TopicPermissions } from '../../../common/enums';

export class UserTopicPermissionsDto {
  @Expose()
  userId: Types.ObjectId;

  @Expose()
  setBy: Types.ObjectId;

  @Expose()
  topicId: Types.ObjectId;

  @Expose()
  granted?: TopicPermissions[];

  @Expose()
  revoked?: TopicPermissions[];

  @Expose()
  revokedBy?: Types.ObjectId;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // Not Implemented
  // @Expose()
  // previousChange?: Types.ObjectId;
}
