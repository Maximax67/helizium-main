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
  CategoryPermissions,
  GlobalPermissions,
  TokenLimits,
  TokenTypes,
  TopicPermissions,
} from '../src/common/enums';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { CategoriesModule, CategoryService } from '../src/modules/categories';
import { CategoryPermissionsFullDto } from '../src/modules/categories/dtos';
import { UserCategoryPermissionsArrayDto } from '../src/modules/users/dtos';

describe('UserCategoryPermissionsController (e2e)', () => {
  let app: NestFastifyApplication;
  let client: ClientGrpc;

  const users = new Array<string>(5);

  let categoryId: string;

  const getRequestParams = (
    method: 'GET' | 'POST' | 'DELETE',
    targetUserId: string,
    actionUserId: string,
    permissions?: CategoryPermissionsFullDto,
  ) => ({
    method,
    url: `/u/${targetUserId}/p/c/${categoryId}`,
    headers: getAuthHeaders(
      actionUserId,
      TokenTypes.ACCESS,
      TokenLimits.DEFAULT,
    ),
    payload: permissions,
  });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => ({ uri: await getMongoUri() }),
        }),
        UsersModule,
        CategoriesModule,
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

    await userGlobalPermissionService.setIfAllowed(users[1], users[0], [
      GlobalPermissions.BYPASS_HIERARCHY,
      GlobalPermissions.VIEW_OTHERS_PERMISSIONS,
      GlobalPermissions.SET_PERMISSIONS,
      GlobalPermissions.SET_PERMISSIONS_PROPAGATION,
      GlobalPermissions.REVOKE_PERMISSIONS,
      GlobalPermissions.REVOKE_PERMISSIONS_PROPAGATION,
    ]);

    await userGlobalPermissionService.setIfAllowed(users[2], users[1], [
      GlobalPermissions.BYPASS_HIERARCHY,
      GlobalPermissions.SET_PERMISSIONS,
      GlobalPermissions.REVOKE_PERMISSIONS,
    ]);

    await userGlobalPermissionService.setIfAllowed(users[4], users[1], [
      GlobalPermissions.BYPASS_HIERARCHY,
      GlobalPermissions.SET_PERMISSIONS,
      GlobalPermissions.REVOKE_PERMISSIONS,
    ]);

    const categoryService = app.get<CategoryService>(CategoryService);
    expect(categoryService).toBeDefined();

    const rootCategory = await categoryService.getRootFullInfo();
    categoryId = rootCategory.category._id.toString();
  });

  it('/u/:userId/p/c/:categoryId (GET) - Should return empty permissions for user', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[3]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(
      result.payload,
    ) as UserCategoryPermissionsArrayDto;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(0);
  });

  it('/u/:userId/p/c/:categoryId (POST) - Should set permissions for user', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[1], users[0], {
        categoriesGranted: [CategoryPermissions.CREATE],
        categoriesRevoked: [CategoryPermissions.RESTORE],
        topicsGranted: [],
        topicsRevoked: [TopicPermissions.COMMENT_SELF],
      }),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/u/:userId/p/c/:categoryId (POST) - Should forbid to set permissions for user (already set)', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[1], users[0], {
        categoriesGranted: [CategoryPermissions.CREATE],
        categoriesRevoked: [CategoryPermissions.RESTORE],
        topicsGranted: [],
        topicsRevoked: [TopicPermissions.COMMENT_SELF],
      }),
    );

    expect(result.statusCode).toBe(409);

    // TODO add template check
  });

  it('/u/:userId/p/c/:categoryId (GET) - Forbidden to view permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[3]),
    );

    expect(result.statusCode).toBe(403);

    // TODO Add template check
  });

  it('/u/:userId/p/c/:categoryId (GET) - Should return self category permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[1]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(
      result.payload,
    ) as UserCategoryPermissionsArrayDto;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(1);

    const permissions = payload.permissions[0];
    expect(permissions.categoryId).toBe(categoryId);
    expect(permissions.userId).toBe(users[1]);
    expect(permissions.setBy).toBe(users[0]);
    expect(permissions.revokedBy).toBe(null);

    expect(permissions.categoriesGranted).toStrictEqual([
      CategoryPermissions.CREATE,
    ]);
    expect(permissions.categoriesRevoked).toStrictEqual([
      CategoryPermissions.RESTORE,
    ]);
    expect(permissions.topicsGranted).toStrictEqual([]);
    expect(permissions.topicsRevoked).toStrictEqual([
      TopicPermissions.COMMENT_SELF,
    ]);

    expect(typeof permissions.createdAt).toBe('string');
    expect(typeof permissions.updatedAt).toBe('string');
  });

  it('/u/:userId/p/c/:categoryId (GET) - Should return category permissions', async () => {
    const result = await app.inject(
      getRequestParams('GET', users[1], users[0]),
    );

    expect(result.statusCode).toBe(200);

    const payload = JSON.parse(
      result.payload,
    ) as UserCategoryPermissionsArrayDto;

    expect(payload).toHaveProperty('permissions');
    expect(payload.permissions).toBeInstanceOf(Array);
    expect(payload.permissions.length).toBe(1);

    const permissions = payload.permissions[0];
    expect(permissions.categoryId).toBe(categoryId);
    expect(permissions.userId).toBe(users[1]);
    expect(permissions.setBy).toBe(users[0]);
    expect(permissions.revokedBy).toBe(null);

    expect(permissions.categoriesGranted).toStrictEqual([
      CategoryPermissions.CREATE,
    ]);
    expect(permissions.categoriesRevoked).toStrictEqual([
      CategoryPermissions.RESTORE,
    ]);
    expect(permissions.topicsGranted).toStrictEqual([]);
    expect(permissions.topicsRevoked).toStrictEqual([
      TopicPermissions.COMMENT_SELF,
    ]);

    expect(typeof permissions.createdAt).toBe('string');
    expect(typeof permissions.updatedAt).toBe('string');
  });

  it('/u/:userId/p/c/:categoryId (POST) - Should forbid to set permissions for user (hierarchy)', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[1], users[2], {
        categoriesGranted: [],
        categoriesRevoked: [CategoryPermissions.EDIT],
        topicsGranted: [TopicPermissions.COMMENT],
        topicsRevoked: [],
      }),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/u/:userId/p/c/:categoryId (POST) - Should forbid to set permissions for user (bypass hierarchy)', async () => {
    const result = await app.inject(
      getRequestParams('POST', users[1], users[4], {
        categoriesGranted: [],
        categoriesRevoked: [CategoryPermissions.EDIT],
        topicsGranted: [TopicPermissions.COMMENT],
        topicsRevoked: [],
      }),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it(`/u/:userId/p/c/:categoryId (POST) - Forbidden to set permissions for user without ${GlobalPermissions.SET_PERMISSIONS} privilege`, async () => {
    const result = await app.inject(
      getRequestParams('POST', users[4], users[3], {
        categoriesGranted: [CategoryPermissions.CREATE],
        categoriesRevoked: [CategoryPermissions.RESTORE],
        topicsGranted: [],
        topicsRevoked: [TopicPermissions.COMMENT_SELF],
      }),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  afterAll(async () => {
    await app.close();
    await closeMemoryServerConnection();
  });
});
