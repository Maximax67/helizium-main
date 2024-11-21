import { PermissionsArray } from '../../../common/dtos';
import { CategoryPermissions, TopicPermissions } from '../../../common/enums';

export class CategoryExtendedPermissionsArrayDto {
  topics: PermissionsArray<TopicPermissions>;
  selfTopics: PermissionsArray<TopicPermissions>;

  categories: PermissionsArray<CategoryPermissions>;
  selfCategories: PermissionsArray<CategoryPermissions>;
}
