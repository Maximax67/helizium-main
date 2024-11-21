import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { closeMemoryServerConnection } from '../src/common/helpers';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            whitelist: true,
          }),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/ (GET)', async () => {
    const result = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(result.statusCode).toEqual(200);

    const payload = JSON.parse(result.payload);

    expect(payload).toEqual({
      title: expect.any(String),
      version: expect.any(String),
      environment: expect.any(String),
    });
  });

  afterAll(async () => {
    await closeMemoryServerConnection();
    await app.close();
  });
});
