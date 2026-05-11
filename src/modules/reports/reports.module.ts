import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportSchema } from './schemas/report.schema';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { Collections } from '../../common/enums';
import { UserSchema } from '../users/schemas';
import { TaskSchema } from '../tasks/schemas/task.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.REPORTS, schema: ReportSchema },
      { name: Collections.USERS, schema: UserSchema },
      { name: Collections.TASKS, schema: TaskSchema },
    ]),
  ],
  providers: [ReportService],
  controllers: [ReportController],
})
export class ReportsModule { }
