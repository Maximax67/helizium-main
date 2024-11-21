import { IsArray, IsEnum } from 'class-validator';
import { GlobalPermissions } from '../../../common/enums';

export class SetGlobalPermissionsDto {
  @IsArray()
  @IsEnum(GlobalPermissions, { each: true })
  permissions: GlobalPermissions[];
}
