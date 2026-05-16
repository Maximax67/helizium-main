import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskSchema } from './schemas/task.schema';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { Collections } from '../../common/enums';
import { UserSchema, UserCategoryPermissionsSchema } from '../users/schemas';
import { CategorySchema } from '../categories/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.TASKS, schema: TaskSchema },
      { name: Collections.USERS, schema: UserSchema },
      { name: Collections.USER_CATEGORY_PERMISSIONS, schema: UserCategoryPermissionsSchema },
      { name: Collections.CATEGORIES, schema: CategorySchema },
    ]),
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TasksModule { }
