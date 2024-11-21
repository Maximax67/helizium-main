import { Test, TestingModule } from '@nestjs/testing';
import {
  ClientGrpc,
  ClientsModule,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { config } from '../src/config';
import {
  SERVICE_NAME as USER_SERVICE_NAME,
  PACKAGE_NAME as USERS_PACKAGE_NAME,
  UserGrpcService,
} from '../src/modules/users';
import {
  closeMemoryServerConnection,
  generateUsername,
  getAuthHeaders,
  getMongoUri,
} from '../src/common/helpers';
import { UsersModule } from '../src/modules/users';
import { firstValueFrom } from 'rxjs';
import { Types } from 'mongoose';

import { faker } from '@faker-js/faker';
import { TokenLimits, TokenTypes } from '../src/common/enums';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

describe('UserController (e2e)', () => {
  let app: NestFastifyApplication;
  let client: ClientGrpc;
  let userServiceGrpcClient: UserGrpcService;

  let userId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => ({ uri: await getMongoUri() }),
        }),
        UsersModule,
        ClientsModule.register([
          {
            name: USER_SERVICE_NAME,
            transport: Transport.GRPC,
            options: {
              package: USERS_PACKAGE_NAME,
              protoPath: join(
                __dirname,
                '../src/modules/users/users.grpc.proto',
              ),
              url: config.grpcUrl,
            },
          },
        ]),
      ],
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

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: USERS_PACKAGE_NAME,
        protoPath: join(__dirname, '../src/modules/users/users.grpc.proto'),
        url: config.grpcUrl,
      },
    });

    await app.startAllMicroservices();
    await app.init();

    client = app.get<ClientGrpc>(USER_SERVICE_NAME);
    userServiceGrpcClient =
      client.getService<UserGrpcService>(USER_SERVICE_NAME);
  });

  it('SignUp (gRPC) should sign up a user', async () => {
    const signUpData = {
      username: generateUsername(),
      email: faker.internet.email(),
    };

    const result = await firstValueFrom(
      userServiceGrpcClient.signUp(signUpData),
    );

    expect(result).toBeDefined();
    expect(result.userId).toBeDefined();
    expect(Types.ObjectId.isValid(result.userId!)).toBe(true);

    userId = result.userId!;
  });

  it('/u/me (GET) - Get user info', async () => {
    const headers = getAuthHeaders(
      userId,
      TokenTypes.ACCESS,
      TokenLimits.DEFAULT,
    );
    const result = await app.inject({
      method: 'GET',
      url: '/u/me',
      headers,
    });

    expect(result.payload).toBeTruthy();
    expect(result.statusCode).toEqual(200);

    const payload = JSON.parse(result.payload);

    expect(payload).toHaveProperty('id');
    expect(payload.id).toBe(userId);

    expect(payload).toHaveProperty('user');
    expect(payload.user).toBeInstanceOf(Object);

    expect(payload).toHaveProperty('categoryPermissions');
    expect(payload).toHaveProperty('topicPermissions');

    expect(payload.topicPermissions).toBeInstanceOf(Array);
    expect(payload.categoryPermissions).toBeInstanceOf(Array);
  });

  it('DeleteUser (gRPC) - Should delete user', async () => {
    const deleteUserData = { userId };

    const result = await firstValueFrom(
      userServiceGrpcClient.deleteUser(deleteUserData),
    );

    expect(result).toBeDefined();
  });

  it('/u/me (GET) - Should not return user info for banned user', async () => {
    const headers = getAuthHeaders(
      userId,
      TokenTypes.ACCESS,
      TokenLimits.DEFAULT,
    );
    const result = await app.inject({
      method: 'GET',
      url: '/u/me',
      headers,
    });

    expect(result.payload).toBeTruthy();
    expect(result.statusCode).toEqual(404);

    // TODO check for template error
    //const payload = JSON.parse(result.payload);

    //expect(payload).toHaveProperty('type');
    //expect(payload.type).toBe(Errors. error template )
  });

  afterAll(async () => {
    await closeMemoryServerConnection();
    await app.close();
  });
});
