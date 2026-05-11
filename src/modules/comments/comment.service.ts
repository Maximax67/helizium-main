import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Collections } from '../../common/enums';
import { User } from '../users/schemas';
import { Task } from '../tasks/schemas/task.schema';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Collections.COMMENTS)
    private readonly commentModel: Model<Comment>,

    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,

    @InjectModel(Collections.TASKS)
    private readonly taskModel: Model<Task>,
  ) { }

  private toOid(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    return new Types.ObjectId(id);
  }

  async getComments(taskId: string, requestingUserId?: string): Promise<any[]> {
    const task = await this.taskModel.findOne({
      _id: this.toOid(taskId),
      isDeleted: false,
    }).lean();
    if (!task) throw new NotFoundException('Task not found');

    const comments = await this.commentModel
      .find({ taskId: this.toOid(taskId), isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();

    const userIds = [...new Set(comments.map((c: any) => c.userId.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id username globalPermissions')
      .lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    return comments.map((c: any) => {
      const user = userMap.get(c.userId.toString());
      return {
        id: c._id.toString(),
        taskId: c.taskId.toString(),
        userId: c.userId.toString(),
        username: user?.username || 'Unknown',
        text: c.text,
        createdAt: c.createdAt?.toISOString(),
        isAdmin: !!(user?.globalPermissions?.permissions?.length),
        isAuthor: c.userId.toString() === (task as any).authorId?.toString(),
      };
    });
  }

  async createComment(taskId: string, userId: string, text: string): Promise<any> {
    const task = await this.taskModel.findOne({
      _id: this.toOid(taskId),
      isDeleted: false,
    }).lean();
    if (!task) throw new NotFoundException('Task not found');

    const comment = await this.commentModel.create({
      taskId: this.toOid(taskId),
      userId: this.toOid(userId),
      text,
    });

    const user = await this.userModel.findById(userId).select('_id username globalPermissions').lean();

    return {
      id: comment._id.toString(),
      taskId: taskId,
      userId: userId,
      username: (user as any)?.username || 'Unknown',
      text: comment.text,
      createdAt: (comment as any).createdAt?.toISOString(),
      isAdmin: !!((user as any)?.globalPermissions?.permissions?.length),
      isAuthor: (task as any).authorId?.toString() === userId,
    };
  }

  async deleteComment(
    taskId: string,
    commentId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const comment = await this.commentModel.findOne({
      _id: this.toOid(commentId),
      taskId: this.toOid(taskId),
      isDeleted: false,
    });

    if (!comment) throw new NotFoundException('Comment not found');

    if (!isAdmin && comment.userId.toString() !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.commentModel.updateOne({ _id: comment._id }, { $set: { isDeleted: true } });
  }
}
