import { PermissionsSet } from '../../../common/dtos';
import { CategoryPermissions, TopicPermissions } from '../../../common/enums';

export class CategoryExtendedPermissionsSetDto {
  topics: PermissionsSet<TopicPermissions>;
  selfTopics: PermissionsSet<TopicPermissions>;

  categories: PermissionsSet<CategoryPermissions>;
  selfCategories: PermissionsSet<CategoryPermissions>;
}
