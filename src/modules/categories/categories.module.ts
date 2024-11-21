import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategorySchema } from './schemas';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { Collections } from '../../common/enums';
import { UsersModule } from '../users';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Collections.CATEGORIES, schema: CategorySchema },
    ]),
    UsersModule,
  ],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoriesModule {}
