import { Expose, Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';

export class PublicUserDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() || obj.id)
  id: string;

  @Expose()
  username: string;

  @Expose()
  isBanned: boolean;

  @Expose()
  @Transform(({ obj }) => !!(obj.globalPermissions?.permissions?.length))
  isAdmin: boolean;

  rating: number;
  joinedDate: string;
  bio?: string;
  location?: string;
  industry?: string;
}

export class TaskResponseDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.categoryId?.toString())
  categoryId: string;

  @Expose()
  @Transform(({ obj }) => obj.authorId?.toString())
  authorId: string;

  @Expose()
  title: string;

  @Expose()
  content: string;

  @Expose()
  @Transform(({ obj }) => obj.dueDate?.toISOString?.() || obj.dueDate)
  dueDate: string;

  @Expose()
  @Transform(({ obj }) => (obj.createdAt || obj.postedAt)?.toISOString?.() || obj.createdAt)
  postedAt: string;

  @Expose()
  price: number;

  @Expose()
  currency: string;

  @Expose()
  @Transform(({ obj }) => (obj.applicants || []).map((id: Types.ObjectId) => id.toString()))
  applicants: string[];

  @Expose()
  @Transform(({ obj }) => (obj.rejectedApplicants || []).map((id: Types.ObjectId) => id.toString()))
  rejectedApplicants: string[];

  @Expose()
  @Transform(({ obj }) => obj.performerId?.toString() || null)
  performerId: string | null;

  @Expose()
  workResult: string | null;

  @Expose()
  completed: boolean;

  @Expose()
  status: string;

  @Expose()
  rejectionMessage: string | null;

  @Expose()
  contractTxHash: string | null;

  @Expose()
  performerRating: number | null;
}
