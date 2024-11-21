import { join } from 'path';
import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import { config } from './config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import mongoose from 'mongoose';
import mongooseLong from 'mongoose-long';
import { PACKAGE_NAME as USERS_PACKAGE_NAME } from './modules/users';
import { TracerModule } from './modules/tracer';

mongooseLong(mongoose);

async function bootstrap() {
  TracerModule.initialize();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(fastifyCookie);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: USERS_PACKAGE_NAME,
      protoPath: join(__dirname, './modules/users/users.grpc.proto'),
      url: config.grpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.listen({
    port: config.port,
    host: config.ip || '0.0.0.0',
  });
}
bootstrap();
