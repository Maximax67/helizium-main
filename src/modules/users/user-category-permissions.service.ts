import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  User,
  UserCategoryPermissions,
  UserCategoryPermissionsDocument,
} from './schemas';
import {
  CategoryPermissions,
  Collections,
  GlobalPermissions,
  TopicPermissions,
} from '../../common/enums';
import { CategoriesPermissionsDto } from '../categories/dtos';
import { arraysHaveSameValues } from '../../common/helpers';

@Injectable()
export class UserCategoryPermissionsService {
  constructor(
    @InjectModel(Collections.USER_CATEGORY_PERMISSIONS)
    private readonly userCategoryPermissionsModel: Model<UserCategoryPermissions>,

    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,
  ) {}

  async set(
    userId: Types.ObjectId,
    categoryId: Types.ObjectId,
    setByUserId: Types.ObjectId,
    categoriesGranted?: CategoryPermissions[],
    categoriesRevoked?: CategoryPermissions[],
    topicsGranted?: TopicPermissions[],
    topicsRevoked?: TopicPermissions[],
    timestamps: boolean = true,
  ): Promise<void> {
    const grantedCategories = new Set(categoriesGranted);
    const revokedCategories = new Set(categoriesRevoked);
    const grantedTopics = new Set(topicsGranted);
    const revokedTopics = new Set(topicsRevoked);

    for (const category of grantedCategories) {
      if (revokedCategories.has(category)) {
        throw new ConflictException(
          `Category permission "${category}" cannot be both granted and revoked.`,
        );
      }
    }

    for (const topic of grantedTopics) {
      if (revokedTopics.has(topic)) {
        throw new ConflictException(
          `Topic permission "${topic}" cannot be both granted and revoked.`,
        );
      }
    }

    await this.userCategoryPermissionsModel.findOneAndUpdate(
      {
        userId,
        categoryId,
      },
      {
        setBy: setByUserId,
        categoriesGranted,
        categoriesRevoked,
        topicsGranted,
        topicsRevoked,
        revokedBy: null,
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        timestamps,
      },
    );
  }

  async revoke(
    userId: Types.ObjectId,
    categoryId: Types.ObjectId,
    revokedByUserId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.userCategoryPermissionsModel.updateOne(
      {
        userId,
        categoryId,
        revokedBy: null,
      },
      {
        revokedBy: revokedByUserId,
      },
    );

    return !!result.modifiedCount;
  }

  async get(
    userId: Types.ObjectId,
    categoryId: Types.ObjectId,
  ): Promise<UserCategoryPermissionsDocument[]> {
    return this.userCategoryPermissionsModel.find({ userId, categoryId });
  }

  async getForSpecificCategories(
    userId: Types.ObjectId,
    categoryIds: Types.ObjectId[],
  ): Promise<CategoriesPermissionsDto> {
    const result = await this.userCategoryPermissionsModel
      .find({
        userId,
        categoryId: { $in: categoryIds },
        revokedBy: null,
      })
      .sort({ categoryId: 1 });

    const permissions = result.reduce(
      (acc: CategoriesPermissionsDto, category) => {
        acc[category.categoryId.toString()] = {
          ...(category.categoriesGranted && {
            categoriesGranted: category.categoriesGranted,
          }),
          ...(category.categoriesRevoked && {
            categoriesRevoked: category.categoriesRevoked,
          }),
          ...(category.topicsGranted && {
            topicsGranted: category.topicsGranted,
          }),
          ...(category.topicsRevoked && {
            topicsRevoked: category.topicsRevoked,
          }),
        };
        return acc;
      },
      {},
    );

    return permissions;
  }

  async getIfAllowed(
    userId: string,
    categoryId: string,
    getById: string,
  ): Promise<UserCategoryPermissionsDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const categoryObjectId = new Types.ObjectId(categoryId);

    const permissions = await this.get(userObjectId, categoryObjectId);
    if (userId === getById || !permissions.length) {
      return permissions;
    }

    const getByObjectId = new Types.ObjectId(getById);
    if (
      !permissions.every(
        (record) =>
          record.setBy !== getByObjectId && record.revokedBy !== getByObjectId,
      )
    ) {
      return permissions;
    }

    const userHasGlobalPermission = await this.userModel.exists({
      _id: getByObjectId,
      isDeleted: false,
      'globalPermissions.permissions': {
        $elemMatch: { $eq: GlobalPermissions.VIEW_OTHERS_PERMISSIONS },
      },
    });

    if (!userHasGlobalPermission) {
      throw new ForbiddenException('Forbidden');
    }

    return permissions;
  }

  async setIfAllowed(
    userId: string,
    categoryId: string,
    setById: string,
    categoriesGranted: CategoryPermissions[],
    categoriesRevoked: CategoryPermissions[],
    topicsGranted: TopicPermissions[],
    topicsRevoked: TopicPermissions[],
  ): Promise<void> {
    if (userId === setById) {
      throw new ForbiddenException('can not set permissions to self');
    }

    const userObjectId = new Types.ObjectId(userId);
    const categoryObjectId = new Types.ObjectId(categoryId);
    const setByObjectId = new Types.ObjectId(setById);

    const userCategoryPermissions =
      await this.userCategoryPermissionsModel.findOne({
        userId: userObjectId,
        categoryId: categoryObjectId,
        revokedBy: null,
      });

    const isRevokeAll =
      !categoriesGranted.length &&
      !categoriesRevoked.length &&
      !topicsGranted.length &&
      !topicsRevoked.length;

    if (isRevokeAll && !userCategoryPermissions) {
      throw new ConflictException(
        'User already does not have any permissions for specified category',
      );
    }

    const searchUserIdQuery =
      userCategoryPermissions && userCategoryPermissions.setBy !== setByObjectId
        ? [userObjectId, setByObjectId, userCategoryPermissions.setBy]
        : [userObjectId, setByObjectId];

    const globalPermissionsRequest = await this.userModel.aggregate([
      {
        $match: {
          _id: { $in: searchUserIdQuery },
          isDeleted: false,
        },
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
          _id: 1,
          setBy: '$globalPermissions.setBy',
          permissions: '$globalPermissions.permissions',
          isInHierarchy: {
            $in: [setByObjectId, '$hierarchy._id'],
          },
        },
      },
    ]);

    let targetUser: any;
    let actionUser: any;
    let currentSetter: any;

    globalPermissionsRequest.forEach((doc) => {
      if (doc._id.equals(userObjectId)) {
        targetUser = doc;
      } else if (doc._id.equals(setByObjectId)) {
        actionUser = doc;
      } else if (
        userCategoryPermissions &&
        doc._id.equals(userCategoryPermissions.setBy)
      ) {
        currentSetter = doc;
      }
    });

    if (!actionUser) {
      throw new NotFoundException('User not found');
    }

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (!userCategoryPermissions) {
      if (
        !actionUser.permissions?.includes(GlobalPermissions.SET_PERMISSIONS)
      ) {
        throw new ForbiddenException(
          `Forbidden without ${GlobalPermissions.SET_PERMISSIONS} privilege`,
        );
      }
    } else if (isRevokeAll) {
      if (
        !actionUser.permissions?.includes(GlobalPermissions.REVOKE_PERMISSIONS)
      ) {
        throw new ForbiddenException(
          `Forbidden without ${GlobalPermissions.REVOKE_PERMISSIONS} privilege`,
        );
      }
    } else {
      // Check for permission revoke and set
      const hasSetPermission = actionUser.permissions?.includes(
        GlobalPermissions.SET_PERMISSIONS,
      );
      const hasRevokePermissions = actionUser.permissions?.includes(
        GlobalPermissions.REVOKE_PERMISSIONS,
      );

      if (!hasSetPermission || !hasRevokePermissions) {
        const toCheck1 = [
          new Set(categoriesGranted),
          new Set(categoriesRevoked),
          new Set(topicsGranted),
          new Set(topicsRevoked),
        ];

        const toCheck2 = [
          new Set(userCategoryPermissions.categoriesGranted),
          new Set(userCategoryPermissions.categoriesRevoked),
          new Set(userCategoryPermissions.topicsGranted),
          new Set(userCategoryPermissions.topicsRevoked),
        ];

        if (!hasSetPermission) {
          for (let i = 0; i < 4; i++) {
            const set1: Set<string> = toCheck1[i];
            const set2: Set<string> = toCheck2[i];

            for (const permission of set1) {
              if (!set2.has(permission)) {
                throw new ForbiddenException(
                  `Forbidden without ${GlobalPermissions.SET_PERMISSIONS} privilege`,
                );
              }
            }
          }
        }

        if (!hasRevokePermissions) {
          for (let i = 0; i < 4; i++) {
            const set1: Set<string> = toCheck1[i];
            const set2: Set<string> = toCheck2[i];

            for (const permission of set2) {
              if (!set1.has(permission)) {
                throw new ForbiddenException(
                  `Forbidden without ${GlobalPermissions.REVOKE_PERMISSIONS} privilege`,
                );
              }
            }
          }
        }
      }
    }

    const hasBypass: boolean = actionUser.permissions?.includes(
      GlobalPermissions.BYPASS_HIERARCHY,
    );

    if (
      targetUser.setBy &&
      targetUser.permissions?.length && // Users with all privileges revoked lost their place in hierarchy
      (!hasBypass ||
        targetUser?.permissions?.includes(
          GlobalPermissions.BYPASS_HIERARCHY,
        )) &&
      !targetUser.isInHierarchy
    ) {
      throw new ForbiddenException(
        'Not in permission hierarchy with target user',
      );
    }

    if (
      currentSetter &&
      currentSetter.setBy &&
      currentSetter.permissions?.length && // Users with all privileges revoked lost their place in hierarchy
      (!hasBypass ||
        currentSetter?.permissions?.includes(
          GlobalPermissions.BYPASS_HIERARCHY,
        )) &&
      !currentSetter.isInHierarchy
    ) {
      throw new ForbiddenException(
        'Not in permission hierarchy with current permissions setter',
      );
    }

    if (isRevokeAll) {
      const result = await this.userCategoryPermissionsModel.updateOne(
        {
          _id: userCategoryPermissions!._id,
          revokedBy: null,
        },
        {
          revokedBy: setByObjectId,
        },
      );

      if (!result.modifiedCount) {
        throw new NotFoundException('Already revoked');
      }

      return;
    }

    categoriesGranted.sort();
    categoriesRevoked.sort();
    topicsGranted.sort();
    topicsRevoked.sort();

    const newPermissionsObject: UserCategoryPermissions = {
      userId: userObjectId,
      setBy: setByObjectId,
      categoryId: categoryObjectId,
      categoriesGranted,
      categoriesRevoked,
      topicsGranted,
      topicsRevoked,
      revokedBy: null,
    };

    if (!userCategoryPermissions) {
      await this.userCategoryPermissionsModel.create(newPermissionsObject);
      return;
    }

    if (
      setByObjectId.equals(userCategoryPermissions.setBy) &&
      arraysHaveSameValues(
        categoriesGranted,
        userCategoryPermissions.categoriesGranted,
      ) &&
      arraysHaveSameValues(
        categoriesRevoked,
        userCategoryPermissions.categoriesRevoked,
      ) &&
      arraysHaveSameValues(
        topicsGranted,
        userCategoryPermissions.topicsGranted,
      ) &&
      arraysHaveSameValues(topicsRevoked, userCategoryPermissions.topicsRevoked)
    ) {
      throw new ConflictException(
        'The same permissions for target user were already set by current user',
      );
    }

    const session = await this.userCategoryPermissionsModel.startSession();
    session.startTransaction();

    try {
      const revokeOldResult = await this.userCategoryPermissionsModel.updateOne(
        {
          _id: userCategoryPermissions._id,
          revokedBy: null,
        },
        {
          revokedBy: setByObjectId,
        },
        { session },
      );

      if (!revokeOldResult.modifiedCount) {
        throw new NotFoundException('Privileges changed for user');
      }

      await this.userCategoryPermissionsModel.create([newPermissionsObject], {
        session,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async revokeAllIfAllowed(
    userId: string,
    categoryId: string,
    setById: string,
  ): Promise<void> {
    return this.setIfAllowed(userId, categoryId, setById, [], [], [], []);
  }
}
