import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyKeys, Model, Types } from 'mongoose';

import { User, UserDocument } from './schemas';
import { UserInfoDto } from './dtos';
import { Collections, GlobalPermissions } from '../../common/enums';
import { SystemUserIdProvider } from '../../common/providers';
import { SYSTEM_USERNAME } from '../../common/constants';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,
    private readonly systemUserIdProvider: SystemUserIdProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystemUser();
  }

  private async ensureSystemUser(): Promise<void> {
    const result = await this.userModel.findOneAndUpdate(
      {
        username: SYSTEM_USERNAME,
        email: null,
      },
      {
        globalPermissions: {
          permissions: Object.values(GlobalPermissions),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInserta: true,
        timestamps: false,
        projection: {
          _id: 1,
        },
      },
    );

    this.systemUserIdProvider.systemUserId = result._id;
  }

  async create(username: string, email: string): Promise<string> {
    const user = await this.userModel.findOneAndUpdate(
      { username, email },
      { $setOnInsert: { username } },
      { upsert: true, new: true, projection: { _id: 1 } },
    );

    return user._id.toString();
  }

  private async changePropertyIfFound(
    userId: string,
    property: AnyKeys<User>,
  ): Promise<boolean | null> {
    const result = await this.userModel.updateOne(
      { _id: userId },
      { $set: property },
    );

    if (result.matchedCount === 0) {
      return null;
    }

    return result.modifiedCount !== 0;
  }

  async delete(userId: string): Promise<boolean | null> {
    return await this.changePropertyIfFound(userId, { isDeleted: true });
  }

  async ban(userId: string): Promise<boolean | null> {
    return await this.changePropertyIfFound(userId, { isBanned: true });
  }

  async unban(userId: string) {
    return await this.changePropertyIfFound(userId, { isBanned: false });
  }

  async getIdByUsername(username: string): Promise<string | null> {
    const result = await this.userModel.findOne({ username }, { _id: 1 });

    return result?._id.toString() ?? null;
  }

  async getUser(userId: string): Promise<UserDocument> {
    const result = await this.userModel.findOne({ userId });
    if (!result) {
      throw new NotFoundException('User not exists');
    }

    return result;
  }

  async getUserInfo(userId: string): Promise<UserInfoDto> {
    const userInfo = await this.userModel.aggregate([
      { $match: { _id: new Types.ObjectId(userId), isDeleted: false } },
      {
        $lookup: {
          from: Collections.USER_CATEGORY_PERMISSIONS,
          localField: '_id',
          foreignField: 'userId',
          as: 'categoryPermissions',
        },
      },
      {
        $lookup: {
          from: Collections.USER_TOPIC_PERMISSIONS,
          localField: '_id',
          foreignField: 'userId',
          as: 'topicPermissions',
        },
      },
      {
        $project: {
          id: { $toString: '$_id' },
          user: '$$ROOT',
          categoryPermissions: '$categoryPermissions',
          topicPermissions: '$topicPermissions',
        },
      },
    ]);

    if (!userInfo.length) {
      throw new NotFoundException('User not exists');
    }

    return userInfo[0];
  }
}
