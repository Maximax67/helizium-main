import { join } from 'path';
import * as WS from 'ws';
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
import { ChatWsService } from './modules/chat/chat-ws.service';

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
      protoPath: join(process.cwd(), 'src/modules/users/users.grpc.proto'),
      url: config.grpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.listen({
    port: config.port,
    host: config.ip || '0.0.0.0',
  });

  // Manual WebSocket server — bypasses NestJS WS abstractions entirely
  // With Fastify, getHttpServer() returns the Fastify instance, not the raw
  // http.Server. We must use getHttpAdapter().getInstance().server instead.
  const chatWsService = app.get(ChatWsService);
  const fastify = app.getHttpAdapter().getInstance();
  const httpServer = fastify.server; // actual Node.js http.Server
  const wss = new WS.Server({ server: httpServer, path: '/chat-ws' });

  wss.on('connection', (ws: WS.WebSocket) => {
    console.log('[WS] new connection');
    let userId: string | null = null;

    const authTimeout = setTimeout(() => {
      if (ws.readyState === WS.WebSocket.OPEN) {
        ws.close(4001, 'Auth timeout');
      }
    }, 10_000);

    ws.on('message', (raw: WS.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          event?: string;
          data?: { token?: string };
        };

        if (msg.event === 'auth' && !userId) {
          const id = chatWsService.consumeToken(msg.data?.token ?? '');
          if (!id) {
            ws.close(4001, 'Invalid or expired token');
            return;
          }
          clearTimeout(authTimeout);
          userId = id;
          chatWsService.addClient(userId, ws);
          console.log(`[WS] authenticated: ${userId}`);
          ws.send(JSON.stringify({ type: 'connected' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (userId) {
        console.log(`[WS] disconnected: ${userId}`);
        chatWsService.removeClient(userId);
        userId = null;
      }
    });
  });
}
bootstrap();
