import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentSchema } from './schemas/comment.schema';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Collections } from '../../common/enums';
import { UserSchema } from '../users/schemas';
import { TaskSchema } from '../tasks/schemas/task.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.COMMENTS, schema: CommentSchema },
      { name: Collections.USERS, schema: UserSchema },
      { name: Collections.TASKS, schema: TaskSchema },
    ]),
  ],
  providers: [CommentService],
  controllers: [CommentController],
})
export class CommentsModule { }
