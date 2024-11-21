import { Model, Types } from 'mongoose';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from './schemas';
import {
  CategoriesPermissionsDto,
  CategoryExtendedPermissionsArrayDto,
  CategoryExtendedPermissionsSetDto,
  CreateCategoryDto,
  EditCategoryDto,
  MergedUserOnlyCategoriesPermissionsDto,
} from './dtos';
import { arraysHaveSameValues, binarySearch } from '../../common/helpers';
import {
  CategoryPermissions,
  Collections,
  TopicPermissions,
} from '../../common/enums';
import { UserCategoryPermissionsService } from '../users';
import {
  CATEGORIES_MAX_DEPTH,
  INT_BITS_SIZE,
  MAX_ACTIVE_CATEGORIES,
  MAX_INNER_CATEGORIES,
  ROOT_CATEGORY_ALLOWED_TOPICS,
  ROOT_CATEGORY_TITLE,
  ROOT_CATEGORY_PERMISSIONS,
  ROOT_CATEGORY_TOPICS_PERMISSIONS,
} from '../../common/constants';
import { SystemUserIdProvider } from '../../common/providers';

@Injectable()
export class CategoryService implements OnModuleInit {
  private readonly minValue = -(1n << (BigInt(INT_BITS_SIZE) - 1n));
  private readonly maxValue: bigint;

  private readonly blockSizes: bigint[] = new Array(CATEGORIES_MAX_DEPTH + 1);
  private rootCategoryId: Types.ObjectId;

  constructor(
    private readonly userCategoryPermissionsService: UserCategoryPermissionsService,
    private readonly systemUserIdProvider: SystemUserIdProvider,

    @InjectModel(Collections.CATEGORIES)
    private readonly categoryModel: Model<Category>,
  ) {
    let depth = 0;
    let currentSize = 1n;
    this.blockSizes[0] = currentSize;

    while (
      currentSize <= MAX_ACTIVE_CATEGORIES &&
      depth < CATEGORIES_MAX_DEPTH
    ) {
      currentSize = 1n + currentSize * BigInt(MAX_INNER_CATEGORIES);
      this.blockSizes[++depth] = currentSize;
    }

    if (depth != CATEGORIES_MAX_DEPTH || currentSize > MAX_ACTIVE_CATEGORIES) {
      throw Error(
        'Insufficient unique values for categories CATEGORIES_MAX_DEPTH and innerTopics',
      );
    }

    this.blockSizes.reverse();
    this.maxValue = currentSize - this.minValue;
  }

  async onModuleInit(): Promise<void> {
    const systemUserId = this.systemUserIdProvider.systemUserId;
    this.rootCategoryId = await this.ensureRootCategory(systemUserId);
    await this.giveSystemAllPermissions(systemUserId, this.rootCategoryId);
  }

  private async ensureRootCategory(
    systemUserId: Types.ObjectId,
  ): Promise<Types.ObjectId> {
    const result = await this.categoryModel.findOneAndUpdate(
      {
        location: this.minValue,
      },
      {
        title: ROOT_CATEGORY_TITLE,
        owner: systemUserId,
        allowedTopicTypes: ROOT_CATEGORY_ALLOWED_TOPICS,
        permissions: {
          categoriesGranted: ROOT_CATEGORY_PERMISSIONS,
          topicsGranted: ROOT_CATEGORY_TOPICS_PERMISSIONS,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        timestamps: false,
        projection: {
          _id: 1,
        },
      },
    );

    return result._id;
  }

  private isRootLocation(location: bigint): boolean {
    return location === this.minValue;
  }

  private async giveSystemAllPermissions(
    systemUserId: Types.ObjectId,
    rootCategoryId: Types.ObjectId,
  ): Promise<void> {
    await this.userCategoryPermissionsService.set(
      systemUserId,
      rootCategoryId,
      systemUserId,
      Object.values(CategoryPermissions),
      undefined,
      Object.values(TopicPermissions),
      undefined,
      false,
    );
  }

  getPath(location: bigint): bigint[] {
    if (location > this.maxValue) {
      throw new Error('> max');
    }

    if (location < this.minValue) {
      throw new Error('< min');
    }

    if (location === this.minValue) {
      return [this.minValue];
    }

    const path: bigint[] = [this.minValue];
    let pathItemLocation = this.minValue;

    for (let i = 1; i < CATEGORIES_MAX_DEPTH; i++) {
      const iterBlockSize = this.blockSizes[i];
      pathItemLocation =
        ((location - pathItemLocation - 1n) / iterBlockSize) * iterBlockSize +
        pathItemLocation +
        1n;

      path.push(pathItemLocation);

      if (location === pathItemLocation) {
        return path;
      }
    }

    path.push(location);

    return path;
  }

  getDepth(location: bigint): number {
    return this.getPath(location).length - 1;
  }

  getDepthFromPath(path: bigint[]): number {
    return path.length - 1;
  }

  getInnerCategoriesLocationRange(location: bigint): bigint[] {
    const path = this.getPath(location);
    const depth = this.getDepthFromPath(path);

    if (depth === CATEGORIES_MAX_DEPTH) {
      return [location, location];
    }

    if (depth === 0) {
      return [location, this.maxValue];
    }

    return [location, location + this.blockSizes[depth] - 1n];
  }

  getChildLocations(location: bigint): bigint[] {
    const path = this.getPath(location);
    const depth = this.getDepthFromPath(path);

    if (depth === CATEGORIES_MAX_DEPTH) {
      return [];
    }

    const blockSize = this.blockSizes[depth + 1];
    const childLocations: bigint[] = new Array(MAX_INNER_CATEGORIES);

    let increment = blockSize;
    let lastLocation = location + 1n;
    childLocations[0] = lastLocation;

    for (let i = 1; i < MAX_INNER_CATEGORIES; i++) {
      lastLocation += increment;
      childLocations[i] = lastLocation;
      increment += blockSize;
    }

    return childLocations;
  }

  private async getCategoryById(
    categoryId: string | Types.ObjectId,
    throwErrorIfDeleted = true,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(categoryId);

    if (!category) {
      throw new NotFoundException('Category not exist');
    }

    if (throwErrorIfDeleted && category.isDeleted) {
      throw new NotFoundException('Category deleted');
    }

    return category;
  }

  private async getFullCategoryInfoById(
    categoryId: string | Types.ObjectId,
    throwErrorIfDeleted = true,
  ): Promise<{
    category: CategoryDocument;
    nestedCategories: CategoryDocument[];
  }> {
    const category = await this.getCategoryById(
      categoryId,
      throwErrorIfDeleted,
    );

    const location = category.location;
    const showDeleted = category.isDeleted;
    const childLocations = this.getChildLocations(location);

    const nestedCategories = await this.categoryModel.find({
      location: {
        $in: childLocations,
      },
      isDeleted: showDeleted,
    });

    // TODO add nested topics

    return {
      category,
      nestedCategories,
    };
  }

  private async isActionAllowed(
    category: CategoryDocument,
    userId: string,
    globalPermission: CategoryPermissions,
    selfPermission: CategoryPermissions | undefined = undefined,
  ): Promise<boolean> {
    const categoryOwnerId = category.owner.toString();
    const isOwner = userId === categoryOwnerId;
    const granted = category.permissions.categoriesGranted;

    const isOwnerAndIsSelfPermission = isOwner && !!selfPermission;

    if (
      granted.includes(globalPermission) ||
      (isOwnerAndIsSelfPermission && granted.includes(selfPermission))
    ) {
      return true;
    }

    const path = this.getPath(category.location);
    path.pop();

    const categories = await this.categoryModel.find(
      { location: { $in: path }, isDeleted: false },
      { _id: 1, location: 1, permissions: 1 },
      { $sort: { location: 1 } },
    );

    categories.push(category);

    // If change topic is not explicitly allowed and not explicitly forbidden,
    // should check inherited permissions
    const revoked = category.permissions.categoriesRevoked;
    if (
      path.length &&
      !revoked.includes(globalPermission) &&
      (!isOwnerAndIsSelfPermission || !revoked.includes(selfPermission))
    ) {
      const allPermissions = this.getPermissionsForCategories(categories);
      const granted = allPermissions.categories.granted;
      if (
        granted.has(globalPermission) ||
        (isOwnerAndIsSelfPermission && granted.has(selfPermission))
      ) {
        return true;
      }
    }

    // If not allowed to delete topics, check user permissions
    const categoryObjectIds = categories.map((category) => category._id);
    const userCategoriesPermissions =
      await this.userCategoryPermissionsService.getForSpecificCategories(
        new Types.ObjectId(userId),
        categoryObjectIds,
      );

    const categoryIds = categoryObjectIds.map((id) => id.toString());
    const userCategoryPermissions = this.mergeUserOnlyCategoryPermissions(
      categoryIds,
      userCategoriesPermissions,
    );

    const userGranted = userCategoryPermissions.granted;

    return (
      userGranted.has(globalPermission) ||
      (isOwnerAndIsSelfPermission && userGranted.has(selfPermission))
    );
  }

  async getPermissions(categoryId: string, userId: string | null) {
    const category = await this.get(categoryId, userId);
    const location = category.location;

    const path = this.getPath(location);
    path.pop();

    if (!path.length) {
      return this.getPermissionsForCategories([category]);
    }

    const parentCategories = await this.categoryModel.find(
      {
        location: {
          $in: path,
        },
      },
      { _id: 1, location: 1, permissions: 1 },
      { $sort: { location: 1 } },
    );

    const categories = [...parentCategories, category];

    return this.getPermissionsForCategories(categories);
  }

  async create(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ): Promise<void> {
    const {
      title,
      parentLocation,
      description,
      allowedTopicTypes,
      permissions,
    } = createCategoryDto;

    const path = this.getPath(parentLocation);
    const categories = await this.categoryModel.find(
      { location: { $in: path }, isDeleted: false },
      { _id: 1, location: 1, permissions: 1 },
      { $sort: { location: 1 } },
    );

    if (categories.length !== path.length) {
      throw new NotFoundException('Category not exist');
    }

    const parentId = categories[categories.length - 1]._id;
    const parentPermissions = this.getPermissionsForCategories(categories);

    if (!parentPermissions.categories.granted.has(CategoryPermissions.CREATE)) {
      const categoryObjectIds = categories.map((category) => category._id);
      const userCategoriesPermissions =
        await this.userCategoryPermissionsService.getForSpecificCategories(
          new Types.ObjectId(userId),
          categoryObjectIds,
        );

      const categoryIds = categoryObjectIds.map((id) => id.toString());
      const userCategoryPermissions = this.mergeUserOnlyCategoryPermissions(
        categoryIds,
        userCategoriesPermissions,
      );

      if (!userCategoryPermissions.granted.has(CategoryPermissions.CREATE)) {
        throw new ForbiddenException('Forbidden to create');
      }
    }

    const childLocations = this.getChildLocations(parentLocation);
    const lastChild = childLocations[childLocations.length - 1];

    let categoryLocation: bigint | null = null;
    const isTreeFull = await this.categoryModel.exists({
      location: lastChild,
      isDeleted: false,
    });

    if (!isTreeFull) {
      const lastNodeLocation = await this.categoryModel.findOne(
        { location: { $in: childLocations }, isDeleted: false },
        { location: 1 },
        { sort: { location: -1 } },
      );

      if (lastNodeLocation) {
        const foundLocation = lastNodeLocation.location;
        const index = binarySearch(childLocations, foundLocation);
        categoryLocation = childLocations[index + 1];
      } else {
        categoryLocation = childLocations[0];
      }
    }

    if (categoryLocation === null) {
      const nodeToReplace = await this.categoryModel.aggregate([
        {
          $match: {
            location: { $in: childLocations },
            isDeleted: true,
          },
        },
        {
          $sort: {
            updatedAt: 1,
          },
        },
        {
          $group: {
            _id: '$location',
            record: { $first: '$$ROOT' },
          },
        },
        {
          $lookup: {
            from: Collections.CATEGORIES,
            let: { loc: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$location', '$$loc'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
            ],
            as: 'nonDeletedRecords',
          },
        },
        {
          $match: {
            nonDeletedRecords: { $eq: [] },
          },
        },
        {
          $limit: 1,
        },
        {
          $replaceRoot: { newRoot: '$record' },
        },
      ]);

      if (!nodeToReplace.length) {
        throw new ConflictException('NOT ENOUGH SPACE FOR CATEGORY');
      }

      categoryLocation = nodeToReplace[0].location as bigint;
    }

    await this.categoryModel.create({
      owner: new Types.ObjectId(userId),
      parent: parentId,
      title,
      description,
      allowedTopicTypes,
      permissions,
      location: categoryLocation,
    });
  }

  async delete(categoryId: string, userId: string): Promise<void> {
    const category = await this.getCategoryById(categoryId, false);

    if (category.isDeleted) {
      throw new ConflictException('Category already deleted');
    }

    if (this.isRootLocation(category.location)) {
      throw new ForbiddenException('Forbidden to restore root category');
    }

    const isActionAllowed = await this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.DELETE,
      CategoryPermissions.DELETE_SELF,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden to delete');
    }

    const categoryLocation = category.location;
    const boundaries = this.getInnerCategoriesLocationRange(categoryLocation);
    const [minBoundary, maxBoundary] = boundaries;
    const isSameBoundary = minBoundary === maxBoundary;

    const updateMethod = isSameBoundary ? 'updateOne' : 'updateMany';
    const query = isSameBoundary
      ? { _id: categoryId, isDeleted: false }
      : {
          location: { $min: minBoundary, $max: maxBoundary },
          isDeleted: false,
        };
    const setPipeline = [
      {
        $set: { isDeleted: true },
      },
      {
        $push: {
          deleteHistory: { userId },
        },
      },
      {
        $set: {
          pinHistory: {
            $cond: {
              if: { $eq: [{ $mod: [{ $size: '$pinHistory' }, 2] }, 1] }, // Check if pinHistory length is odd
              then: {
                $concatArrays: ['$pinHistory', [{ userId }]],
              },
              else: '$pinHistory',
            },
          },
        },
      },
    ];

    const result = await this.categoryModel[updateMethod](query, setPipeline);
    if (!result.matchedCount) {
      throw new NotFoundException('Not found (probably already deleted)');
    }

    if (!result.modifiedCount) {
      throw new ConflictException('Not modified');
    }

    // TODO Remove category from topics
    //! If topic has only one category, delete it
    //! OR propagate to parent if not to root
  }

  async edit(
    categoryId: string,
    userId: string,
    editCategoryDto: EditCategoryDto,
  ): Promise<void> {
    const category = await this.getCategoryById(categoryId);

    // Check if unmodified
    const { title, description, permissions, allowedTopicTypes } =
      editCategoryDto;
    const {
      categoriesGranted: currentCategoriesGranted,
      categoriesRevoked: currentCategoriesRevoked,
      topicsGranted: currentTopicsGranted,
      topicsRevoked: currentTopicsRevoked,
    } = category.permissions;

    const isUnmodified =
      category.title === title &&
      category.description === description &&
      arraysHaveSameValues(category.allowedTopicTypes, allowedTopicTypes) &&
      arraysHaveSameValues(
        currentCategoriesGranted,
        permissions.categoriesGranted,
      ) &&
      arraysHaveSameValues(
        currentCategoriesRevoked,
        permissions.categoriesRevoked,
      ) &&
      arraysHaveSameValues(currentTopicsGranted, permissions.topicsGranted) &&
      arraysHaveSameValues(currentTopicsRevoked, permissions.topicsRevoked);

    if (isUnmodified) {
      throw new ConflictException('Not modified');
    }

    if (this.isRootLocation(category.location)) {
      throw new ForbiddenException('Forbidden to edit root category');
    }

    const isActionAllowed = await this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.EDIT,
      CategoryPermissions.EDIT_SELF,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden to edit');
    }

    const result = await this.categoryModel.updateOne(
      {
        _id: categoryId,
        isDeleted: false,
      },
      {
        $set: {
          title,
          description,
          permissions,
          allowedTopicTypes,
        },
      },
    );

    if (!result.matchedCount) {
      throw new NotFoundException('Not found (probably already deleted)');
    }

    if (!result.modifiedCount) {
      throw new ConflictException('Not modified');
    }
  }

  async getRootFullInfo() {
    return this.getFullCategoryInfoById(this.rootCategoryId, true);
  }

  async get(
    categoryId: string,
    userId: string | null,
  ): Promise<CategoryDocument> {
    const category = await this.getCategoryById(categoryId, false);

    if (!category.isDeleted) {
      return category;
    }

    if (!userId) {
      throw new ForbiddenException('Forbidden to see deleted category');
    }

    const isActionAllowed = await this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.VIEW_DELETED,
      CategoryPermissions.VIEW_DELETED_SELF,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden to see deleted category');
    }

    return category;
  }

  async getFullInfo(categoryId: string, userId: string | null) {
    const categoryInfo = await this.getFullCategoryInfoById(categoryId, false);
    const category = categoryInfo.category;

    if (!category.isDeleted) {
      return categoryInfo;
    }

    if (!userId) {
      throw new ForbiddenException('Forbidden to see deleted category');
    }

    const isActionAllowed = await this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.VIEW_DELETED,
      CategoryPermissions.VIEW_DELETED_SELF,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden to see deleted category');
    }

    return categoryInfo;
  }

  async pin(categoryId: string, userId: string): Promise<void> {
    const category = await this.getCategoryById(categoryId);

    if (category.isPinned) {
      throw new ConflictException('Already pinned');
    }

    const isActionAllowed = this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.PIN,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden');
    }

    const result = await this.categoryModel.updateOne(
      {
        _id: categoryId,
        isDeleted: false,
        $expr: {
          $eq: [{ $mod: [{ $size: '$pinHistory' }, 2] }, 0], // Checks if pinHistory length is even
        },
      },
      {
        $push: {
          pinHistory: { userId },
        },
      },
    );

    if (!result.matchedCount) {
      throw new NotFoundException(
        'Not found (probably already deleted or pinned)',
      );
    }

    if (!result.modifiedCount) {
      throw new ConflictException('Not modified');
    }
  }

  async unpin(categoryId: string, userId: string): Promise<void> {
    const category = await this.getCategoryById(categoryId);

    if (!category.isPinned) {
      throw new ConflictException('Not pinned');
    }

    const isActionAllowed = this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.UNPIN,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden');
    }

    const result = await this.categoryModel.updateOne(
      {
        _id: categoryId,
        isDeleted: false,
        $expr: {
          $eq: [{ $mod: [{ $size: '$pinHistory' }, 2] }, 1], // Checks if pinHistory length is odd
        },
      },
      {
        $push: {
          pinHistory: { userId },
        },
      },
    );

    if (!result.matchedCount) {
      throw new NotFoundException(
        'Not found (probably already deleted or unpinned)',
      );
    }

    if (!result.modifiedCount) {
      throw new ConflictException('Not modified');
    }
  }

  async restore(
    categoryId: string,
    userId: string,
    restoreInner: boolean,
  ): Promise<void> {
    const category = await this.getCategoryById(categoryId, false);

    if (!category.isDeleted) {
      throw new ConflictException('Not deleted');
    }

    const categoryLocation = category.location;
    const path = this.getPath(categoryLocation);

    const isActionAllowed = this.isActionAllowed(
      category,
      userId,
      CategoryPermissions.RESTORE,
      CategoryPermissions.RESTORE_SELF,
    );

    if (!isActionAllowed) {
      throw new ForbiddenException('Forbidden');
    }

    const parentLocation = path[path.length - 2];
    const restoreCheck = await this.categoryModel.aggregate([
      {
        $facet: {
          checkNotDeleted: [
            { $match: { location: categoryLocation, isDeleted: false } },
          ],
          getParent: [
            { $match: { location: parentLocation, isDeleted: false } },
          ],
        },
      },
      {
        $project: {
          canBeRestored: { $eq: [{ $size: '$checkNotDeleted' }, 0] },
          parentCategory: { $arrayElemAt: ['$getParent._id', 0] },
        },
      },
    ]);

    if (
      restoreCheck.length !== 2 ||
      !restoreCheck[0] ||
      restoreCheck[1] !== category.parent
    ) {
      throw new ConflictException('Category can not be restored');
    }

    const boundaries = this.getInnerCategoriesLocationRange(categoryLocation);
    const [minBoundary, maxBoundary] = boundaries;

    if (!restoreInner || minBoundary === maxBoundary) {
      const result = await this.categoryModel.updateOne(
        { _id: categoryId, isDeleted: true },
        {
          $set: {
            isDeleted: false,
          },
          $push: {
            deleteHistory: { userId },
          },
        },
      );

      if (!result.matchedCount) {
        throw new NotFoundException('Not found (probably already restored)');
      }

      if (!result.modifiedCount) {
        throw new ConflictException('Not modified');
      }

      return;
    }

    const session = await this.categoryModel.startSession();
    session.startTransaction();

    try {
      await this.categoryModel.aggregate([
        // Step 1: Start with the specified category
        {
          $match: {
            _id: new Types.ObjectId(categoryId),
            isDeleted: true,
          },
        },
        // Step 2: Use $graphLookup to find all child categories
        {
          $graphLookup: {
            from: Collections.CATEGORIES,
            startWith: '$_id',
            connectFromField: '_id',
            connectToField: 'parent',
            as: 'children',
            restrictSearchWithMatch: {
              isDeleted: true,
            },
          },
        },
        // Step 3: Unwind the children array to create separate documents for each child
        {
          $unwind: {
            path: '$children',
            preserveNullAndEmptyArrays: true, // Keep the parent even if it has no children
          },
        },
        // Step 4: Create a new structure that includes both the parent and children
        {
          $project: {
            _id: { $ifNull: ['$children._id', '$_id'] },
          },
        },
        // Step 5: Use $merge to update the documents
        {
          $merge: {
            into: Collections.CATEGORIES,
            on: '_id',
            whenMatched: [
              {
                $set: {
                  isDeleted: false,
                  $push: { deleteHistory: { userId } },
                },
              },
            ],
            whenNotMatched: 'fail',
          },
        },
      ]);

      await session.commitTransaction();
      session.endSession();
    } catch (error: unknown) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  private mergePermissions(
    permissions: { granted: Set<string>; revoked: Set<string> },
    newGranted: string[] = [],
    newRevoked: string[] = [],
  ): void {
    newGranted.forEach((permission) => {
      if (permissions.revoked.has(permission)) {
        permissions.revoked.delete(permission);
      }
      permissions.granted.add(permission);
    });

    newRevoked.forEach((permission) => {
      if (permissions.granted.has(permission)) {
        permissions.granted.delete(permission);
      }
      permissions.revoked.add(permission);
    });
  }

  private getPermissionsForCategories(
    categories: Partial<Category>[],
  ): CategoryExtendedPermissionsSetDto {
    const categoryPermissions = {
      granted: new Set<CategoryPermissions>(),
      revoked: new Set<CategoryPermissions>(),
    };

    const topicPermissions = {
      granted: new Set<TopicPermissions>(),
      revoked: new Set<TopicPermissions>(),
    };

    for (const category of categories) {
      const { permissions } = category;
      const {
        topicsGranted,
        topicsRevoked,
        categoriesGranted,
        categoriesRevoked,
      } = permissions || {};

      this.mergePermissions(
        categoryPermissions,
        categoriesGranted,
        categoriesRevoked,
      );
      this.mergePermissions(topicPermissions, topicsGranted, topicsRevoked);
    }

    const ownPermissions = categories[categories.length - 1].permissions;
    const {
      topicsGranted,
      topicsRevoked,
      categoriesGranted,
      categoriesRevoked,
    } = ownPermissions || {};

    return {
      categories: categoryPermissions,
      topics: topicPermissions,
      selfTopics: {
        granted: new Set<TopicPermissions>(topicsGranted),
        revoked: new Set<TopicPermissions>(topicsRevoked),
      },
      selfCategories: {
        granted: new Set<CategoryPermissions>(categoriesGranted),
        revoked: new Set<CategoryPermissions>(categoriesRevoked),
      },
    };
  }

  convertPermissionsSetToArray(
    permissions: CategoryExtendedPermissionsSetDto,
  ): CategoryExtendedPermissionsArrayDto {
    const { categories, topics, selfCategories, selfTopics } = permissions;

    const toArray = <T extends { granted: Set<any>; revoked: Set<any> }>(
      permissionSet: T,
    ) => ({
      granted: Array.from(permissionSet.granted),
      revoked: Array.from(permissionSet.revoked),
    });

    return {
      categories: toArray(categories),
      topics: toArray(topics),
      selfCategories: toArray(selfCategories),
      selfTopics: toArray(selfTopics),
    };
  }

  mergeUserOnlyCategoryPermissions(
    categoryIds: string[],
    userCategoriesPermissions: CategoriesPermissionsDto,
  ): MergedUserOnlyCategoriesPermissionsDto {
    const categoryPermissions = {
      granted: new Set<CategoryPermissions>(),
      revoked: new Set<CategoryPermissions>(),
    };

    for (const categoryId of categoryIds) {
      const userPermission = userCategoriesPermissions[categoryId];
      if (userPermission) {
        this.mergePermissions(
          categoryPermissions,
          userPermission.categoriesGranted,
          userPermission.categoriesRevoked,
        );
      }
    }

    return categoryPermissions;
  }
}
