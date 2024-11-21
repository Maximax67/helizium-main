import { Types } from 'mongoose';
import { Expose, Type } from 'class-transformer';

import { UserActionHistoryRecord } from '../../../common/schemas';
import { TopicTypes } from '../../../common/enums';
import { CategoryPermissionsFullDto } from './category-permissions.dto';

export class CategoryDto {
  @Expose()
  id: string;

  @Expose()
  location: bigint;

  @Expose()
  @Type(() => String)
  parent: Types.ObjectId;

  @Expose()
  @Type(() => String)
  owner: Types.ObjectId;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose()
  @Type(() => String)
  allowedTopicTypes: TopicTypes[];

  @Expose()
  @Type(() => CategoryPermissionsFullDto)
  permissions: CategoryPermissionsFullDto;

  @Expose()
  @Type(() => String)
  subscribedUsers: Types.ObjectId[];

  @Expose()
  @Type(() => UserActionHistoryRecord)
  pinHistory: UserActionHistoryRecord[];

  @Expose()
  @Type(() => UserActionHistoryRecord)
  deleteHistory: UserActionHistoryRecord[];

  @Expose()
  isDeleted: boolean;

  @Expose()
  isPinned: boolean;
}
