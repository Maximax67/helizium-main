import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { Collections } from '../../common/enums';
import { User } from '../users/schemas';
import { Task } from '../tasks/schemas/task.schema';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Collections.REPORTS) private readonly reportModel: Model<Report>,
    @InjectModel(Collections.USERS) private readonly userModel: Model<User>,
    @InjectModel(Collections.TASKS) private readonly taskModel: Model<Task>,
  ) { }

  private toOid(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    return new Types.ObjectId(id);
  }

  async createReport(taskId: string, reporterId: string, reason: string): Promise<any> {
    const task = await this.taskModel.findOne({ _id: this.toOid(taskId), isDeleted: false }).lean();
    if (!task) throw new NotFoundException('Task not found');

    const count = await this.reportModel.countDocuments({
      taskId: this.toOid(taskId),
      reporterId: this.toOid(reporterId),
    });
    if (count >= 3) throw new ConflictException('Maximum reports per task reached');

    const report = await this.reportModel.create({
      taskId: this.toOid(taskId),
      reporterId: this.toOid(reporterId),
      reason,
    });

    const reporter = await this.userModel.findById(reporterId).select('username').lean();

    return {
      id: report._id.toString(),
      taskId,
      taskTitle: (task as any).title,
      reporterId,
      reporterUsername: (reporter as any)?.username || 'Unknown',
      reason,
      status: report.status,
      createdAt: (report as any).createdAt?.toISOString(),
    };
  }

  async getReports(): Promise<any[]> {
    const reports = await this.reportModel.find().sort({ createdAt: -1 }).lean();

    const taskIds = [...new Set(reports.map((r: any) => r.taskId.toString()))];
    const reporterIds = [...new Set(reports.map((r: any) => r.reporterId.toString()))];

    const [tasks, reporters] = await Promise.all([
      this.taskModel
        .find({ _id: { $in: taskIds.map((id) => new Types.ObjectId(id)) } })
        .select('_id title')
        .lean(),
      this.userModel
        .find({ _id: { $in: reporterIds.map((id) => new Types.ObjectId(id)) } })
        .select('_id username')
        .lean(),
    ]);

    const taskMap = new Map(tasks.map((t: any) => [t._id.toString(), t]));
    const reporterMap = new Map(reporters.map((u: any) => [u._id.toString(), u]));

    return reports.map((r: any) => ({
      id: r._id.toString(),
      taskId: r.taskId.toString(),
      taskTitle: taskMap.get(r.taskId.toString())?.title || 'Unknown',
      reporterId: r.reporterId.toString(),
      reporterUsername: reporterMap.get(r.reporterId.toString())?.username || 'Unknown',
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt?.toISOString(),
    }));
  }

  async updateReportStatus(reportId: string, status: 'resolved' | 'dismissed'): Promise<any> {
    const report = await this.reportModel.findById(this.toOid(reportId));
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'pending') throw new ConflictException('Report already processed');

    report.status = status;
    await report.save();

    return { ...report.toObject(), id: report._id.toString() };
  }
}
