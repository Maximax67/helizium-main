import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TopicTypes } from '../../../common/enums';
import { CategoryPermissionsFullDto } from './category-permissions.dto';
import { IsArrayUnique } from '../../../common/decorators';

export class EditCategoryDto {
  @IsString()
  @Length(3, 100)
  title: string;

  @IsString()
  @Length(3, 255)
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(TopicTypes, { each: true })
  @Validate(IsArrayUnique)
  allowedTopicTypes: [TopicTypes];

  @ValidateNested()
  @Type(() => CategoryPermissionsFullDto)
  permissions: CategoryPermissionsFullDto;
}
