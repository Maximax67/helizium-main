import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TopicTypes } from '../../../common/enums';
import { CategoryPermissionsFullDto } from './category-permissions.dto';
import { IsBigInt } from '../../../common/decorators';

export class CreateCategoryDto {
  @IsString()
  @Length(3, 100)
  title: string;

  @IsBigInt()
  @Transform(({ value }) =>
    (typeof value === 'string' || typeof value === 'number') &&
    /^-?[0-9]+n?$/.test(`${value}`)
      ? BigInt(value)
      : value,
  )
  parentLocation: bigint;

  @IsString()
  @Length(3, 255)
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(TopicTypes, { each: true })
  allowedTopicTypes: TopicTypes[];

  @ValidateNested()
  @Type(() => CategoryPermissionsFullDto)
  permissions: CategoryPermissionsFullDto;
}
