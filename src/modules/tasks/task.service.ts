import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './schemas/task.schema';
import { CreateTaskDto } from './dtos/create-task.dto';
import { EditTaskDto } from './dtos/edit-task.dto';
import { Collections, TopicPermissions } from '../../common/enums';
import { User } from '../users/schemas';
import { UserCategoryPermissions } from '../users/schemas';
import { Category } from '../categories/schemas';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Collections.TASKS)
    private readonly taskModel: Model<Task>,

    @InjectModel(Collections.USERS)
    private readonly userModel: Model<User>,

    @InjectModel(Collections.USER_CATEGORY_PERMISSIONS)
    private readonly userCategoryPermissionsModel: Model<UserCategoryPermissions>,

    @InjectModel(Collections.CATEGORIES)
    private readonly categoryModel: Model<Category>,
  ) { }

  // ─────────────────────────── helpers ─────────────────────────────────

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`Invalid ID: ${id}`);
    return new Types.ObjectId(id);
  }

  private async getTaskOrFail(id: string): Promise<TaskDocument> {
    const task = await this.taskModel.findOne({
      _id: this.toObjectId(id),
      isDeleted: false,
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private mapPublicUser(user: any) {
    return {
      id: user._id.toString(),
      username: user.username,
      isBanned: user.isBanned,
      isAdmin: !!(user.globalPermissions?.permissions?.length),
      rating: user.trustRate || 0,
      joinedDate: user.createdAt?.toISOString?.() || '',
      bio: user.bio || null,
      ethAddress: user.ethAddress || null,
    };
  }

  private enrichTask(t: any, userMap: Map<string, any>) {
    return {
      ...t,
      id: t._id.toString(),
      categoryId: t.categoryId?.toString(),
      authorId: t.authorId?.toString(),
      performerId: t.performerId?.toString() || null,
      disputeRaisedBy: t.disputeRaisedBy?.toString() || null,
      applicants: (t.applicants || []).map((id: Types.ObjectId) => id.toString()),
      rejectedApplicants: (t.rejectedApplicants || []).map((id: Types.ObjectId) => id.toString()),
      postedAt: t.createdAt?.toISOString(),
      dueDate: t.dueDate?.toISOString(),
      author: userMap.get(t.authorId?.toString()) ? this.mapPublicUser(userMap.get(t.authorId?.toString())!) : undefined,
      performer: t.performerId && userMap.get(t.performerId?.toString()) ? this.mapPublicUser(userMap.get(t.performerId?.toString())!) : undefined,
    };
  }

  // ─────────────────────────── public API ──────────────────────────────

  async listTasks(params: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortDir?: string;
    authorId?: string;
    performerId?: string;
    status?: string;
  }) {
    const {
      page = 1, limit = 10,
      categoryId, search, minPrice, maxPrice,
      fromDate, toDate,
      sortBy = 'createdAt', sortDir = 'desc',
      authorId, performerId, status,
    } = params;

    const filter: FilterQuery<Task> = { isDeleted: false };

    if (categoryId) filter.categoryId = this.toObjectId(categoryId);
    if (authorId) filter.authorId = this.toObjectId(authorId);
    if (performerId) filter.performerId = this.toObjectId(performerId);

    // Status filter: only apply if it is a known value
    if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
      filter.status = status as TaskStatus;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }
    if (fromDate || toDate) {
      filter.dueDate = {};
      if (fromDate) filter.dueDate.$gte = new Date(fromDate);
      if (toDate) filter.dueDate.$lte = new Date(toDate);
    }
    if (search) filter.$text = { $search: search };

    const sortMap: Record<string, string> = {
      title: 'title',
      dueDate: 'dueDate',
      price: 'price',
      postedAt: 'createdAt',
    };
    const sortField = sortMap[sortBy] || 'createdAt';
    const sortOrder = sortDir === 'asc' ? 1 : -1;

    const [tasks, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.taskModel.countDocuments(filter),
    ]);

    const userIds = [
      ...new Set([
        ...tasks.map((t) => t.authorId?.toString()),
        ...tasks.filter((t) => t.performerId).map((t) => t.performerId?.toString()),
      ].filter(Boolean)),
    ];

    const users = await this.userModel
      .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id!)) } })
      .select('_id username isBanned globalPermissions trustRate createdAt bio ethAddress')
      .lean();

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const enriched = tasks.map((t: any) => this.enrichTask(t, userMap));

    return { tasks: enriched, total, page, limit };
  }

  async getTask(id: string): Promise<any> {
    const task = await this.getTaskOrFail(id);
    const t: any = task.toObject();

    const userIds = [t.authorId, t.performerId].filter(Boolean);
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('_id username isBanned globalPermissions trustRate createdAt bio ethAddress')
      .lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    return this.enrichTask(t, userMap);
  }

  async createTask(userId: string, dto: CreateTaskDto): Promise<any> {
    const categoryOid = this.toObjectId(dto.categoryId);
    const userOid = this.toObjectId(userId);

    // ── Permission check ──────────────────────────────────────────────
    const category = await this.categoryModel.findOne({
      _id: categoryOid,
      isDeleted: false,
    });
    if (!category) throw new NotFoundException('Category not found');

    // Look up any user-specific override for this category
    const userCatPerm = await this.userCategoryPermissionsModel.findOne({
      userId: userOid,
      categoryId: categoryOid,
      revokedBy: null,
    });

    const userGrantedCreate = userCatPerm?.topicsGranted?.includes(TopicPermissions.CREATE) ?? false;
    const userRevokedCreate = userCatPerm?.topicsRevoked?.includes(TopicPermissions.CREATE) ?? false;

    if (userRevokedCreate) {
      throw new ForbiddenException('You do not have permission to create tasks in this category');
    }

    // If not explicitly granted for the user, fall back to category-level setting
    if (!userGrantedCreate) {
      const catRevoked: string[] = (category.permissions?.topicsRevoked as string[]) || [];
      if (catRevoked.includes(TopicPermissions.CREATE)) {
        throw new ForbiddenException('Task creation is not allowed in this category');
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const task = await this.taskModel.create({
      authorId: userOid,
      categoryId: categoryOid,
      title: dto.title,
      content: dto.content,
      dueDate: new Date(dto.dueDate),
      price: dto.price,
      currency: dto.currency || 'ETH',
      contractTxHash: dto.contractTxHash || null,
    });
    return this.getTask(task._id.toString());
  }

  async editTask(taskId: string, userId: string, dto: EditTaskDto): Promise<any> {
    const task = await this.getTaskOrFail(taskId);

    if (task.authorId.toString() !== userId) {
      throw new ForbiddenException('Not the task author');
    }

    const update: Partial<Task> = {};

    if (dto.contractTxHash !== undefined) {
      update.contractTxHash = dto.contractTxHash;
    }

    const hasContentChanges = dto.title || dto.content || dto.categoryId ||
      dto.price !== undefined || dto.dueDate;

    if (hasContentChanges) {
      if (task.status !== TaskStatus.SEARCHING) {
        throw new ConflictException('Cannot edit task content after freelancer assigned');
      }
      if (task.applicants.length > 0) {
        throw new ConflictException('Cannot edit task with pending applicants');
      }
      if (dto.title) update.title = dto.title;
      if (dto.content) update.content = dto.content;
      if (dto.categoryId) update.categoryId = this.toObjectId(dto.categoryId);
      if (dto.price !== undefined) update.price = dto.price;
      if (dto.dueDate) update.dueDate = new Date(dto.dueDate);
    }

    if (Object.keys(update).length > 0) {
      await this.taskModel.updateOne({ _id: task._id }, { $set: update });
    }

    return this.getTask(taskId);
  }

  async deleteTask(taskId: string, userId: string, isAdmin: boolean): Promise<void> {
    const task = await this.getTaskOrFail(taskId);

    if (!isAdmin && task.authorId.toString() !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    if (task.status !== TaskStatus.SEARCHING) {
      throw new ConflictException('Cannot delete task that is in progress or disputed');
    }

    await this.taskModel.updateOne({ _id: task._id }, { $set: { isDeleted: true } });
  }

  async applyForTask(taskId: string, userId: string): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    const userObjId = this.toObjectId(userId);

    if (task.authorId.toString() === userId) {
      throw new ForbiddenException('Cannot apply for own task');
    }
    if (task.status !== TaskStatus.SEARCHING) {
      throw new ConflictException('Task not accepting applications');
    }
    if (task.applicants.some((id) => id.toString() === userId)) {
      throw new ConflictException('Already applied');
    }
    if (task.rejectedApplicants.some((id) => id.toString() === userId)) {
      throw new ForbiddenException('Application was rejected');
    }

    await this.taskModel.updateOne({ _id: task._id }, { $push: { applicants: userObjId } });
    return this.getTask(taskId);
  }

  async rejectApplicant(taskId: string, applicantId: string, userId: string): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (task.authorId.toString() !== userId) throw new ForbiddenException('Not the task author');

    const appObjId = this.toObjectId(applicantId);
    await this.taskModel.updateOne(
      { _id: task._id },
      { $pull: { applicants: appObjId }, $push: { rejectedApplicants: appObjId } },
    );
    return this.getTask(taskId);
  }

  async approveApplicant(
    taskId: string,
    applicantId: string,
    userId: string,
    contractTxHash?: string,
  ): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (task.authorId.toString() !== userId) throw new ForbiddenException('Not the task author');
    if (!task.applicants.some((id) => id.toString() === applicantId)) {
      throw new NotFoundException('Applicant not found');
    }

    const appObjId = this.toObjectId(applicantId);
    await this.taskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          performerId: appObjId,
          status: TaskStatus.IN_PROGRESS,
          applicants: [],
          contractTxHash: contractTxHash || null,
        },
      },
    );
    return this.getTask(taskId);
  }

  async submitWork(taskId: string, userId: string, workResult: string): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (!task.performerId || task.performerId.toString() !== userId) {
      throw new ForbiddenException('Not the task performer');
    }
    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new ConflictException('Invalid task status');
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      { $set: { workResult, status: TaskStatus.WAITING_APPROVAL } },
    );
    return this.getTask(taskId);
  }

  async completeTask(taskId: string, userId: string, contractTxHash?: string): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (task.authorId.toString() !== userId) throw new ForbiddenException('Not the task author');
    if (task.status !== TaskStatus.WAITING_APPROVAL) {
      throw new ConflictException('Work not submitted');
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          completed: true,
          status: TaskStatus.COMPLETED,
          contractTxHash: contractTxHash || task.contractTxHash,
        },
      },
    );
    return this.getTask(taskId);
  }

  async rejectWork(taskId: string, userId: string, rejectionMessage: string): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (task.authorId.toString() !== userId) throw new ForbiddenException('Not the task author');
    if (task.status !== TaskStatus.WAITING_APPROVAL) {
      throw new ConflictException('Work not submitted');
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      { $set: { workResult: null, rejectionMessage, status: TaskStatus.IN_PROGRESS } },
    );
    return this.getTask(taskId);
  }

  async discardFreelancer(taskId: string, userId: string, isAdmin: boolean): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (!isAdmin) throw new ForbiddenException('Admin only');
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new ConflictException('Task already settled');
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          performerId: null,
          workResult: null,
          rejectionMessage: null,
          disputeRaisedBy: null,
          status: TaskStatus.SEARCHING,
        },
      },
    );
    return this.getTask(taskId);
  }

  async rateTask(taskId: string, userId: string, rating: number): Promise<any> {
    const task = await this.getTaskOrFail(taskId);
    if (task.authorId.toString() !== userId) throw new ForbiddenException('Only task author can rate');
    if (!task.completed) throw new ConflictException('Task not completed');
    if (task.performerRating !== null) throw new ConflictException('Already rated');
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1–5');

    await this.taskModel.updateOne({ _id: task._id }, { $set: { performerRating: rating } });

    if (task.performerId) {
      const performer = await this.userModel.findById(task.performerId);
      if (performer) {
        const currentRate = (performer as any).trustRate || 0;
        const completedTasks = (performer as any).activities?.posts || 0;
        const newRate = completedTasks === 0
          ? rating * 20
          : Math.min(100, (currentRate * completedTasks + rating * 20) / (completedTasks + 1));

        await this.userModel.updateOne(
          { _id: task.performerId },
          { $set: { trustRate: Math.round(newRate) }, $inc: { 'activities.posts': 1 } },
        );
      }
    }

    return this.getTask(taskId);
  }

  // ─────────────────────────── dispute flow ─────────────────────────────

  async raiseDispute(taskId: string, userId: string, isAdmin: boolean): Promise<any> {
    const task = await this.getTaskOrFail(taskId);

    const isAuthor = task.authorId.toString() === userId;
    const isPerformer = task.performerId && task.performerId.toString() === userId;

    if (!isAdmin && !isAuthor && !isPerformer) {
      throw new ForbiddenException('Only the task parties or admin can raise a dispute');
    }

    const allowedStatuses: TaskStatus[] = [
      TaskStatus.IN_PROGRESS,
      TaskStatus.WAITING_APPROVAL,
    ];
    if (!allowedStatuses.includes(task.status)) {
      throw new ConflictException(`Cannot raise dispute in status: ${task.status}`);
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          status: TaskStatus.DISPUTED,
          disputeRaisedBy: this.toObjectId(userId),
        },
      },
    );
    return this.getTask(taskId);
  }

  async resolveDispute(
    taskId: string,
    adminUserId: string,
    favorFreelancer: boolean,
    contractTxHash?: string,
  ): Promise<any> {
    const task = await this.getTaskOrFail(taskId);

    if (task.status !== TaskStatus.DISPUTED) {
      throw new ConflictException('Task is not in disputed status');
    }

    await this.taskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          status: favorFreelancer ? TaskStatus.COMPLETED : TaskStatus.CANCELLED,
          completed: favorFreelancer,
          contractTxHash: contractTxHash || task.contractTxHash,
        },
      },
    );
    return this.getTask(taskId);
  }

  // ─────────────────────────── stats ───────────────────────────────────

  async getMyStats(userId: string): Promise<{ created: number; active: number; completed: number }> {
    const userOid = this.toObjectId(userId);
    const [result] = await this.taskModel.aggregate([
      {
        $facet: {
          created: [
            { $match: { authorId: userOid, isDeleted: false } },
            { $count: 'n' },
          ],
          active: [
            {
              $match: {
                performerId: userOid,
                isDeleted: false,
                status: { $in: [TaskStatus.IN_PROGRESS, TaskStatus.WAITING_APPROVAL, TaskStatus.DISPUTED] },
              },
            },
            { $count: 'n' },
          ],
          completed: [
            {
              $match: {
                performerId: userOid,
                isDeleted: false,
                status: TaskStatus.COMPLETED,
              },
            },
            { $count: 'n' },
          ],
        },
      },
    ]);
    return {
      created: result?.created?.[0]?.n ?? 0,
      active: result?.active?.[0]?.n ?? 0,
      completed: result?.completed?.[0]?.n ?? 0,
    };
  }

  // ─────────────────────────── public user ──────────────────────────────

  async getPublicUser(userId: string): Promise<any> {
    const user = await this.userModel
      .findOne({ _id: this.toObjectId(userId), isDeleted: false })
      .select(
        '_id username isBanned globalPermissions trustRate createdAt bio location industry ethAddress',
      )
      .lean();

    if (!user) throw new NotFoundException('User not found');

    return {
      id: (user as any)._id.toString(),
      username: (user as any).username,
      isBanned: (user as any).isBanned,
      isAdmin: !!((user as any).globalPermissions?.permissions?.length),
      rating: (user as any).trustRate || 0,
      joinedDate: (user as any).createdAt?.toISOString?.() || '',
      bio: (user as any).bio || null,
      location: (user as any).location || null,
      industry: (user as any).industry || null,
      ethAddress: (user as any).ethAddress || null,
    };
  }
}
