import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserGlobalPermissions } from './schemas';
import { Collections, GlobalPermissions } from '../../common/enums';

@Injectable()
export class UserGlobalPermissionService {
  constructor(
    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,
  ) {}

  async get(userId: string): Promise<UserGlobalPermissions> {
    const result = await this.userModel.findOne(
      {
        _id: userId,
        isDeleted: false,
      },
      {
        globalPermissions: 1,
      },
    );

    if (!result) {
      throw new Error('User not exists');
    }

    return result.globalPermissions;
  }

  async getIfAllowed(
    userId: string,
    getById: string,
  ): Promise<UserGlobalPermissions> {
    if (userId === getById) {
      return this.get(userId);
    }

    const userObjectId = new Types.ObjectId(userId);
    const getByObjectId = new Types.ObjectId(getById);

    const result = await this.userModel.find(
      {
        _id: {
          $in: [userObjectId, getByObjectId],
        },
        isDeleted: false,
      },
      {
        _id: 1,
        globalPermissions: 1,
      },
    );

    if (result.length !== 2) {
      throw new NotFoundException('User not exists');
    }

    let actionUserPermissions: UserGlobalPermissions;
    let targetUserPermissions: UserGlobalPermissions;

    const [user1, user2] = result;
    if (user1._id.toString() === userId) {
      targetUserPermissions = user1.globalPermissions;
      actionUserPermissions = user2.globalPermissions;
    } else {
      targetUserPermissions = user2.globalPermissions;
      actionUserPermissions = user1.globalPermissions;
    }

    if (
      actionUserPermissions?.permissions?.includes(
        GlobalPermissions.VIEW_OTHERS_PERMISSIONS,
      ) ||
      !targetUserPermissions?.permissions?.length
    ) {
      return targetUserPermissions;
    }

    const result2 = await this.userModel.aggregate([
      { $match: { _id: userObjectId, isDeleted: false } },
      {
        $graphLookup: {
          from: Collections.USERS,
          startWith: '$globalPermissions.setBy',
          connectFromField: 'globalPermissions.setBy',
          connectToField: '_id',
          as: 'hierarchy',
        },
      },
      {
        $project: {
          permissions: '$globalPermissions',
          isInHierarchy: {
            $in: [getByObjectId, '$hierarchy._id'],
          },
        },
      },
    ]);

    if (!result2 || result2.length !== 1 || !result2[0].isInHierarchy) {
      throw new ForbiddenException(
        `${GlobalPermissions.VIEW_OTHERS_PERMISSIONS} permission required or be in hierarchy`,
      );
    }

    return result2[0].permissions;
  }

  async set(
    userId: string,
    setById: string,
    permissions: GlobalPermissions[],
  ): Promise<void> {
    const uniquePermissionsSorted = [...new Set(permissions)].sort();
    const result = await this.userModel.updateOne(
      {
        _id: userId,
        isDeleted: false,
        'globalPermissions.permissions': { $ne: uniquePermissionsSorted },
      },
      {
        $set: {
          globalPermissions: {
            setBy: new Types.ObjectId(setById),
            permissions: uniquePermissionsSorted,
            timestamp: Date.now(),
          },
        },
      },
    );

    if (!result.matchedCount) {
      // TODO think how to separate error without making more requests to db
      throw new NotFoundException(
        'User not exist, was deleted or have identical permissions',
      );
    }
  }

  async revokeAll(userId: string, revokedById: string): Promise<void> {
    await this.set(userId, revokedById, []);
  }

  async setIfAllowed(
    userId: string,
    setById: string,
    permissions: GlobalPermissions[],
  ): Promise<void> {
    if (userId === setById) {
      throw new ForbiddenException('User can not change self permissions');
    }

    const actionUser = await this.userModel.findById(setById);
    if (!actionUser) {
      throw new NotFoundException('Action user not found');
    }

    const actionUserPermissions = actionUser?.globalPermissions?.permissions;
    if (!actionUserPermissions || !actionUserPermissions.length) {
      throw new ForbiddenException(
        `User does not have any privileges to change other user permissions`,
      );
    }

    const actionUserPermissionsSet = new Set(actionUserPermissions);
    const permissionsSet = new Set(permissions);
    if (
      permissionsSet.has(GlobalPermissions.SET_PERMISSIONS) &&
      !actionUserPermissionsSet.has(
        GlobalPermissions.SET_PERMISSIONS_PROPAGATION,
      )
    ) {
      throw new ForbiddenException(
        `User cannot set ${GlobalPermissions.SET_PERMISSIONS} without ${GlobalPermissions.SET_PERMISSIONS_PROPAGATION} privilege`,
      );
    }

    if (
      permissionsSet.has(GlobalPermissions.REVOKE_PERMISSIONS) &&
      !actionUserPermissionsSet.has(
        GlobalPermissions.REVOKE_PERMISSIONS_PROPAGATION,
      )
    ) {
      throw new ForbiddenException(
        `User cannot set ${GlobalPermissions.REVOKE_PERMISSIONS} without ${GlobalPermissions.REVOKE_PERMISSIONS_PROPAGATION} privilege`,
      );
    }

    for (const permission of permissionsSet) {
      if (!actionUserPermissionsSet.has(permission)) {
        throw new ForbiddenException(
          `User does not have permission to set ${permission}`,
        );
      }
    }

    const targetUserSearchResult = await this.userModel.aggregate([
      {
        $match: { _id: new Types.ObjectId(userId), isDeleted: false },
      },
      {
        $graphLookup: {
          from: Collections.USERS,
          startWith: '$globalPermissions.setBy',
          connectFromField: 'globalPermissions.setBy',
          connectToField: '_id',
          as: 'hierarchy',
        },
      },
      {
        $project: {
          setBy: '$globalPermissions.setBy',
          permissions: '$globalPermissions.permissions',
          isInHierarchy: {
            $in: [new Types.ObjectId(setById), '$hierarchy._id'],
          },
        },
      },
    ]);

    if (!targetUserSearchResult.length) {
      throw new NotFoundException('User not found');
    }

    const targetUser = targetUserSearchResult[0];
    const targetUserPermissions = targetUser.permissions as
      | GlobalPermissions[]
      | undefined;

    if (
      targetUser.setBy &&
      targetUserPermissions?.length && // Users with all privileges revoked lost their place in hierarchy
      (!actionUserPermissionsSet.has(GlobalPermissions.BYPASS_HIERARCHY) ||
        targetUserPermissions?.includes(GlobalPermissions.BYPASS_HIERARCHY)) &&
      !targetUser.isInHierarchy
    ) {
      throw new ForbiddenException('Forbidden, not in permissions hierarchy');
    }

    if (targetUserPermissions && targetUserPermissions.length) {
      const revokedPermissions = targetUserPermissions.filter(
        (perm) => !permissionsSet.has(perm),
      );

      if (
        revokedPermissions.length &&
        !actionUserPermissionsSet.has(GlobalPermissions.REVOKE_PERMISSIONS)
      ) {
        throw new ForbiddenException(
          `User does not have ${GlobalPermissions.REVOKE_PERMISSIONS} privilege`,
        );
      }

      const targetUserPermissionsSet = new Set(targetUserPermissions);
      const setPermissions = permissions.filter(
        (perm) => !targetUserPermissionsSet.has(perm),
      );

      if (
        setPermissions.length &&
        !actionUserPermissionsSet.has(GlobalPermissions.SET_PERMISSIONS)
      ) {
        throw new ForbiddenException(
          `User does not have ${GlobalPermissions.SET_PERMISSIONS} privilege`,
        );
      }

      await this.set(userId, setById, permissions);

      return;
    }

    if (!permissionsSet.size) {
      throw new ConflictException(
        'Target user already does not have any permissions',
      );
    }

    if (!actionUserPermissionsSet.has(GlobalPermissions.SET_PERMISSIONS)) {
      throw new ForbiddenException(
        `User does not have ${GlobalPermissions.SET_PERMISSIONS} privilege`,
      );
    }

    await this.set(userId, setById, permissions);
  }

  async revokeAllIfAllowed(userId: string, revokedById: string): Promise<void> {
    return this.setIfAllowed(userId, revokedById, []);
  }
}
