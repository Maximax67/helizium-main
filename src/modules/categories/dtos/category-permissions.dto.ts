import { IsArray, IsEnum, Validate } from 'class-validator';
import { CategoryPermissions, TopicPermissions } from '../../../common/enums';
import {
  IsArrayUnique,
  NoDuplicateValuesConstraint,
} from '../../../common/decorators';
import { Expose } from 'class-transformer';

export class CategoryPermissionsFullDto {
  @Expose()
  @IsArray()
  @IsEnum(CategoryPermissions, { each: true })
  @Validate(IsArrayUnique)
  categoriesGranted: CategoryPermissions[] = [];

  @Expose()
  @IsArray()
  @IsEnum(CategoryPermissions, { each: true })
  @Validate(IsArrayUnique)
  @Validate(NoDuplicateValuesConstraint, ['categoriesGranted'])
  categoriesRevoked: CategoryPermissions[] = [];

  @Expose()
  @IsArray()
  @IsEnum(TopicPermissions, { each: true })
  @Validate(IsArrayUnique)
  topicsGranted: TopicPermissions[] = [];

  @Expose()
  @IsArray()
  @IsEnum(TopicPermissions, { each: true })
  @Validate(IsArrayUnique)
  @Validate(NoDuplicateValuesConstraint, ['topicsGranted'])
  topicsRevoked: TopicPermissions[] = [];
}

export class CategoryPermissionsDto {
  categoriesGranted?: string[];
  categoriesRevoked?: string[];
  topicsGranted?: string[];
  topicsRevoked?: string[];
}

export class CategoriesPermissionsDto {
  [categoryId: string]: CategoryPermissionsDto;
}

export class MergedUserOnlyCategoriesPermissionsDto {
  granted: Set<CategoryPermissions>;
  revoked: Set<CategoryPermissions>;
}
