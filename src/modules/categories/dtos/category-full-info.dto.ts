import { Expose, Type } from 'class-transformer';
import { CategoryDto } from './category.dto';

export class CategoryFullInfoDto {
  @Expose()
  @Type(() => CategoryDto)
  category: CategoryDto;

  @Expose()
  @Type(() => CategoryDto)
  nestedCategories: CategoryDto[];
}
