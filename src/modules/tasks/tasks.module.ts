import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskSchema } from './schemas/task.schema';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { Collections } from '../../common/enums';
import { UserSchema } from '../users/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.TASKS, schema: TaskSchema },
      { name: Collections.USERS, schema: UserSchema },
    ]),
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TasksModule { }
