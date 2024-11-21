import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getMongoUri } from './common/helpers';
import { UsersModule } from './modules/users';
import { CategoriesModule } from './modules/categories';
import { TracerModule } from './modules/tracer';

@Module({
  imports: [
    TracerModule,
    MongooseModule.forRootAsync({
      useFactory: async () => ({ uri: await getMongoUri() }),
    }),
    UsersModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
      }),
    },
  ],
})
export class AppModule {}
