import { Expose, Type } from 'class-transformer';
import { UserDto } from './user.dto';
import { IsArray, ValidateNested } from 'class-validator';
import { UserTopicPermissionsDto } from './topic-permissions.dto';
import { UserCategoryPermissionsDto } from './user-category-permissions.dto';

export class UserInfoDto {
  @Expose()
  id: string;

  @Expose()
  @ValidateNested()
  @Type(() => UserDto)
  user: UserDto;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserCategoryPermissionsDto)
  categoryPermissions: UserCategoryPermissionsDto[];

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserTopicPermissionsDto)
  topicPermissions: UserTopicPermissionsDto[];
}
