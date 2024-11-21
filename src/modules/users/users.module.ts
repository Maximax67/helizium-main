import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  UserCategoryPermissionsSchema,
  UserSchema,
  UserTopicPermissionsSchema,
} from './schemas';
import { UserService } from './user.service';
import { UserController } from './user.contoller';
import { Collections } from '../../common/enums';
import { UserCategoryPermissionsService } from './user-category-permissions.service';
import { SystemUserIdProvider } from '../../common/providers';
import { UserGlobalPermissionService } from './user-global-permissions.service';
import { UserGlobalPermissionsController } from './user-global-permissions.controller';
import { UserCategoryPermissionsController } from './user-category-permissions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.USERS, schema: UserSchema },
      {
        name: Collections.USER_CATEGORY_PERMISSIONS,
        schema: UserCategoryPermissionsSchema,
      },
      {
        name: Collections.USER_TOPIC_PERMISSIONS,
        schema: UserTopicPermissionsSchema,
      },
    ]),
  ],
  providers: [
    UserService,
    UserCategoryPermissionsService,
    UserGlobalPermissionService,
    SystemUserIdProvider,
  ],
  controllers: [
    UserController,
    UserGlobalPermissionsController,
    UserCategoryPermissionsController,
  ],
  exports: [UserService, UserCategoryPermissionsService, SystemUserIdProvider],
})
export class UsersModule {}
