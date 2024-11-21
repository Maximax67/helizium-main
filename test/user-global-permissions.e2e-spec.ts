import { faker } from '@faker-js/faker';
import {
  ClientGrpc,
  ClientsModule,
  Transport,
  MicroserviceOptions,
} from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { TestingModule, Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';
import {
  getMongoUri,
  generateUsername,
  closeMemoryServerConnection,
  getAuthHeaders,
} from '../src/common/helpers';
import { UsersModule } from '../src/modules/users';
import {
  SERVICE_NAME as USER_SERVICE_NAME,
  PACKAGE_NAME as USERS_PACKAGE_NAME,
  UserGrpcService,
} from '../src/modules/users';
import { config } from '../src/config';
import { UserGlobalPermissionService } from '../src/modules/users/user-global-permissions.service';
import { SystemUserIdProvider } from '../src/common/providers';
import {
  GlobalPermissions,
  TokenLimits,
  TokenTypes,
} from '../src/common/enums';
import { UserGlobalPermissions } from '../src/modules/users/schemas';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { UserGlobalPermissionsDto } from '../src/modules/users/dtos';

describe('UserGlobalPermissionsController (e2e)', () => {
  let app: NestFastifyApplication;
  let client: ClientGrpc;

  const users = new Array<string>(5);
  const notExistsingUserId = '12345678901234567890abcd';

  const getRequestParams = (
    method: 'GET' | 'POST' | 'DELETE',
    targetUserId: string,
    actionUserId: string,
    permissions?: GlobalPermissions[],
  ) => ({
    method,
    url: `/u/${targetUserId}/p/g`,
    headers: getAuthHeaders(
      actionUserId,
      TokenTypes.ACCESS,
      TokenLimits.DEFAULT,
    ),
    payload: permissions ? { permissions } : undefined,
  });

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

    const systemUserIdProvider =
      app.get<SystemUserIdProvider>(SystemUserIdProvider);
    expect(systemUserIdProvider).toBeDefined();

    users[0] = systemUserIdProvider.systemUserId.toString();

    client = app.get<ClientGrpc>(USER_SERVICE_NAME);
    const userServiceGrpcClient =
      client.getService<UserGrpcService>(USER_SERVICE_NAME);

    for (let i = 1; i < 5; i++) {
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

      users[i] = result.userId!;
    }

    expect(new Set(users).size).toBe(5);

    const userGlobalPermissionService = app.get<UserGlobalPermissionService>(
      UserGlobalPermissionService,
    );
    expect(userGlobalPermissionService).toBeDefined();

    await userGlobalPermissionService.set(
      users[1],
      users[0],
      Object.values(GlobalPermissions),
    );
  });

  it('/u/:userId/p/g (GET) - Should return user permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[2], users[1]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(0);

    expect(payload.setBy).toBeUndefined();
    expect(payload.timestamp).toBeUndefined();
  });

  it('/u/:userId/p/g (GET) - Should forbid to not return permissions without auth', async () => {
    const params = getRequestParams('GET', users[2], users[1]);
    params.headers = {} as any;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(401);

    // TODO add template check
  });

  it(`/u/:userId/p/g (GET) - Should forbid to return permissions if user does not have ${GlobalPermissions.VIEW_OTHERS_PERMISSIONS} privilege  and not in hierarchy`, async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[2]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should not revoke permissions without auth', async () => {
    const params = getRequestParams('DELETE', users[1], users[0]);
    params.headers = {} as any;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(401);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should not revoke permissions if target and action user are the same', async () => {
    const params = getRequestParams('DELETE', users[1], users[1]);

    const result = await app.inject(params);

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should return 409 conflict as target user not have any permissions', async () => {
    const result = await app.inject(
      getRequestParams('DELETE', users[2], users[1]),
    );

    expect(result.statusCode).toBe(409);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should not allow to set wrong permissions', async () => {
    const params = getRequestParams('POST', users[2], users[1]);
    params.payload = {
      permissions: ['SOMETHING_NOT_IN_ENUM'],
    } as any;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(400);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should not allow to set permissions without auth', async () => {
    const params = getRequestParams('POST', users[2], users[1], [
      GlobalPermissions.SET_PERMISSIONS,
      GlobalPermissions.BAN,
      GlobalPermissions.EDIT_PROFILES,
    ]);
    params.headers = {} as any;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(401);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[2], users[1], [
        GlobalPermissions.SET_PERMISSIONS,
        GlobalPermissions.BAN,
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (GET) - Should return user permissions with currently set', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[2], users[1]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(result.payload) as UserGlobalPermissionsDto;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(3);
    expect(payload.permissions.sort()).toEqual(
      [
        GlobalPermissions.SET_PERMISSIONS,
        GlobalPermissions.BAN,
        GlobalPermissions.EDIT_PROFILES,
      ].sort(),
    );

    expect(payload.setBy).toBe(users[1]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp!)).toBeTruthy();
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[2], [GlobalPermissions.BAN]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (POST) - Should forbid to set permissions which user does not have', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[2], [GlobalPermissions.UNBAN]),
    );

    expect(result.statusCode).toBe(403);
  });

  it('/u/:userId/p/g (GET) - Should return user permissions as this user in hierarchy', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[3], users[2]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(1);
    expect(payload.permissions).toEqual([GlobalPermissions.BAN]);

    expect(payload.setBy).toBe(users[2]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp!)).toBeTruthy();
  });

  it('/u/:userId/p/g (GET) - Should return empty permissions for users without permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[4], users[3]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(0);

    expect(payload.setBy).toBeUndefined();
    expect(payload.timestamp).toBeUndefined();
  });

  it(`/u/:userId/p/g (POST) - Should forbid to set permissions without ${GlobalPermissions.SET_PERMISSIONS} privilege`, async () => {
    const result = await app.inject(
      getRequestParams('POST', users[4], users[3], [GlobalPermissions.BAN]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it(`/u/:userId/p/g (DELETE) - Should forbid to revoke permissions without ${GlobalPermissions.REVOKE_PERMISSIONS} privilege`, async () => {
    const result = await app.inject(
      getRequestParams('DELETE', users[3], users[2]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[4], users[1], [GlobalPermissions.BAN]),
    );

    expect(result.statusCode).toBe(201);
  });

  it(`/u/:userId/p/g (GET) - Should forbid to return permissions if user does not have ${GlobalPermissions.VIEW_OTHERS_PERMISSIONS} privilege and not in hierarchy`, async () => {
    const result = await app.inject(
      getRequestParams('GET', users[4], users[2]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should forbid to set permissions if not in hierarchy', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[4], users[2], [
        GlobalPermissions.BAN,
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should not allow to set permissions if user already have the same permissions', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[4], users[1], [GlobalPermissions.BAN]),
    );

    expect(result.statusCode).toBe(404);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should allow to revoke permissions', async () => {
    // Revoke BAN Permission
    const result = await app.inject(
      getRequestParams('POST', users[2], users[1], [
        GlobalPermissions.SET_PERMISSIONS,
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(201);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should forbid to set new permissions as user does not have some permissions which other user has', async () => {
    // Revoke BAN Permission
    const result = await app.inject(
      getRequestParams('POST', users[3], users[2], [
        GlobalPermissions.BAN,
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should revoke all user permissions', async () => {
    const result = await app.inject(
      getRequestParams('DELETE', users[3], users[1]),
    );

    expect(result.statusCode).toBe(204);
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[2], [
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams(
        'POST',
        users[4],
        users[1],
        Object.values(GlobalPermissions),
      ),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (GET) - Should return user permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[4]),
    );

    expect(result.statusCode).toBe(200);

    const allPermissions = Object.values(GlobalPermissions).sort();
    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(allPermissions.length);
    expect(payload.permissions.sort()).toEqual(allPermissions);

    expect(payload.setBy).toBe(users[0]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp!)).toBeTruthy();
  });

  it('/u/:userId/p/g (DELETE) - Should not revoke permissions if target and action user are not in hierarchy', async () => {
    const params = getRequestParams('DELETE', users[1], users[4]);

    const result = await app.inject(params);

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[4], [
        GlobalPermissions.SET_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (POST) - Should forbid to set permissions if not in hierarchy', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[2], [
        GlobalPermissions.SET_PERMISSIONS,
        GlobalPermissions.EDIT_PROFILES,
      ]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[4], [
        GlobalPermissions.BYPASS_HIERARCHY,
        GlobalPermissions.REVOKE_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (DELETE) - Should revoke all user permissions', async () => {
    const result = await app.inject(
      getRequestParams('DELETE', users[2], users[3]),
    );

    expect(result.statusCode).toBe(204);
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[3], users[4], [
        GlobalPermissions.SET_PERMISSIONS,
        GlobalPermissions.BYPASS_HIERARCHY,
        GlobalPermissions.REVOKE_PERMISSIONS,
        GlobalPermissions.VIEW_OTHERS_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it(`/u/:userId/p/g (POST) - Should not allow to set revoke permission without ${GlobalPermissions.REVOKE_PERMISSIONS_PROPAGATION} privilege`, async () => {
    const result = await app.inject(
      getRequestParams('POST', users[2], users[3], [
        GlobalPermissions.REVOKE_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should set permissions to user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[2], users[3], [
        GlobalPermissions.VIEW_OTHERS_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/g (GET) - Should return user permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[2]),
    );

    expect(result.statusCode).toBe(200);

    const allPermissions = Object.values(GlobalPermissions).sort();
    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(allPermissions.length);
    expect(payload.permissions.sort()).toEqual(allPermissions);

    expect(payload.setBy).toBe(users[0]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp!)).toBeTruthy();
  });

  it('/u/:userId/p/g (POST) - Should not set permissions to not existing user', async () => {
    const result = await app.inject(
      getRequestParams('POST', notExistsingUserId, users[3], [
        GlobalPermissions.VIEW_OTHERS_PERMISSIONS,
      ]),
    );

    expect(result.statusCode).toBe(404);

    // TODO add template check
  });

  it('/u/:userId/p/g (GET) - Should not return permissions for not existing user', async () => {
    const result = await app.inject(
      getRequestParams('GET', notExistsingUserId, users[1]),
    );

    expect(result.statusCode).toBe(404);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should not revoke permissions to not existing user', async () => {
    const result = await app.inject(
      getRequestParams('DELETE', notExistsingUserId, users[1]),
    );

    expect(result.statusCode).toBe(404);

    // TODO add template check
  });

  it('/u/:userId/p/g (POST) - Should not set permissions to user if api token used', async () => {
    const params = getRequestParams('POST', users[2], users[1], [
      GlobalPermissions.BAN,
    ]);
    params.headers['x-token-type'] = TokenTypes.API;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (DELETE) - Should not revoke permissions to user if api token used', async () => {
    const params = getRequestParams('POST', users[2], users[1]);
    params.headers['x-token-type'] = TokenTypes.API;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/g (GET) - Should allow to view user permissions with API tokens', async () => {
    const params = getRequestParams('GET', users[1], users[2]);
    params.headers['x-token-type'] = TokenTypes.API;
    params.headers['x-token-limits'] = TokenLimits.READ_ONLY;

    const result = await app.inject(params);

    expect(result.statusCode).toBe(200);

    const allPermissions = Object.values(GlobalPermissions).sort();
    const payload = JSON.parse(result.payload) as UserGlobalPermissions;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(allPermissions.length);
    expect(payload.permissions.sort()).toEqual(allPermissions);

    expect(payload.setBy).toBe(users[0]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp!)).toBeTruthy();
  });

  afterAll(async () => {
    await closeMemoryServerConnection();
    await app.close();
  });
});
