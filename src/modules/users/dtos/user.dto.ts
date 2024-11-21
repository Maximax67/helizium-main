import { Expose } from 'class-transformer';
import {
  Badge,
  UserActivities,
  UserContact,
  UserGlobalPermissions,
  UsernameColor,
} from '../schemas';
import { Badges, UsernameColors } from '../../../common/enums';

export class UserDto {
  @Expose()
  username: string;

  @Expose()
  email: string;

  @Expose()
  isBanned: boolean;

  @Expose()
  avatar?: string;

  @Expose()
  balance: number;

  @Expose()
  trustRate: number;

  @Expose()
  badges: Badge[];

  @Expose()
  usernameColors: UsernameColor[];

  @Expose()
  selectedUsernameColor: UsernameColors;

  @Expose()
  pinnedBadge: Badges;

  @Expose()
  bio?: string;

  @Expose()
  birthsday?: Date;

  @Expose()
  contacts?: UserContact[];

  @Expose()
  isBirthsday: boolean;

  @Expose()
  activities: UserActivities;

  @Expose()
  globalPermissions: UserGlobalPermissions;
}
