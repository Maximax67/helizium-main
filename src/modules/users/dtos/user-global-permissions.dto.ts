import { Expose } from 'class-transformer';
import { GlobalPermissions } from '../../../common/enums';

export class UserGlobalPermissionsDto {
  @Expose()
  permissions: GlobalPermissions[];

  @Expose()
  setBy?: string;

  @Expose()
  timestamp?: string;
}
