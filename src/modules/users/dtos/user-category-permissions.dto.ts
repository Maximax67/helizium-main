import { Expose, Type } from 'class-transformer';
import { Types } from 'mongoose';
import { CategoryPermissions, TopicPermissions } from '../../../common/enums';

export class UserCategoryPermissionsDto {
  @Expose()
  @Type(() => String)
  userId: Types.ObjectId;

  @Expose()
  @Type(() => String)
  setBy: Types.ObjectId;

  @Expose()
  @Type(() => String)
  categoryId: Types.ObjectId;

  @Expose()
  categoriesGranted?: CategoryPermissions[];

  @Expose()
  categoriesRevoked?: CategoryPermissions[];

  @Expose()
  topicsGranted?: TopicPermissions[];

  @Expose()
  topicsRevoked?: TopicPermissions[];

  @Expose()
  @Type(() => String)
  revokedBy: Types.ObjectId | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class UserCategoryPermissionsArrayDto {
  @Expose()
  @Type(() => UserCategoryPermissionsDto)
  permissions: UserCategoryPermissionsDto[];
}
