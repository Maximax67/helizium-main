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
  UserGlobalPermissionService,
} from '../src/modules/users';
import {
  closeMemoryServerConnection,
  generateUsername,
  getAuthHeaders,
  getMongoUri,
} from '../src/common/helpers';
import { firstValueFrom } from 'rxjs';
import { Types } from 'mongoose';

import { faker } from '@faker-js/faker';
import {
  GlobalPermissions,
  TokenLimits,
  TokenTypes,
  TopicTypes,
} from '../src/common/enums';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { CategoriesModule } from '../src/modules/categories';
import {
  CategoryDto,
  CategoryFullInfoDto,
  CreateCategoryDto,
  EditCategoryDto,
  RestoreCategoryDto,
} from '../src/modules/categories/dtos';
import { SystemUserIdProvider } from '../src/common/providers';
import { ROOT_CATEGORY_TITLE } from '../src/common/constants';

describe('CategoryController (e2e)', () => {
  let app: NestFastifyApplication;
  let client: ClientGrpc;

  const users = new Array<string>(3);

  let rootCategory: CategoryDto;
  let cat1: CategoryDto;

  const getRequestParams = (
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    categoryId?: string,
    actionUserId?: string,
    data?: CreateCategoryDto | EditCategoryDto | RestoreCategoryDto,
    subpath?: string,
  ) => ({
    method,
    url: subpath
      ? `/categories/${categoryId}/${subpath}`
      : `/categories${categoryId ? '/' + categoryId : ''}`,
    headers: actionUserId
      ? getAuthHeaders(actionUserId, TokenTypes.ACCESS, TokenLimits.DEFAULT)
      : undefined,
    payload: data,
  });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: async () => ({ uri: await getMongoUri() }),
        }),
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

    for (let i = 1; i < 3; i++) {
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

    expect(new Set(users).size).toBe(3);

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

  it('/categories (GET) - Should return root category', async () => {
    const result = await app.inject(getRequestParams('GET'));

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryFullInfoDto;

    expect(payload).toHaveProperty('category');
    expect(typeof payload.category).toBe('object');

    const category = payload.category;

    expect(category).toHaveProperty('owner');
    expect(typeof category.owner).toBe('string');
    expect(category.owner).toBe(users[0]);

    expect(category).toHaveProperty('title');
    expect(typeof category.title).toBe('string');
    expect(category.title).toBe(ROOT_CATEGORY_TITLE);

    expect(category).toHaveProperty('id');
    expect(typeof category.id).toBe('string');

    rootCategory = category;

    expect(payload).toHaveProperty('nestedCategories');
    expect(payload.nestedCategories).toStrictEqual([]);
  });

  it('/categories/:id (GET) - Should return root category', async () => {
    const result = await app.inject(getRequestParams('GET', rootCategory.id));

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryFullInfoDto;

    expect(payload).toHaveProperty('category');
    expect(typeof payload.category).toBe('object');

    const category = payload.category;

    expect(category).toHaveProperty('owner');
    expect(typeof category.owner).toBe('string');
    expect(category.owner).toBe(users[0]);

    expect(category).toHaveProperty('title');
    expect(typeof category.title).toBe('string');
    expect(category.title).toBe(ROOT_CATEGORY_TITLE);

    expect(category).toHaveProperty('id');
    expect(typeof category.id).toBe('string');
    expect(category.id).toBe(rootCategory.id);

    expect(payload).toHaveProperty('nestedCategories');
    expect(payload.nestedCategories).toStrictEqual([]);
  });

  it('/categories/:id/info (GET) - Should return root category info', async () => {
    const result = await app.inject(
      getRequestParams('GET', rootCategory.id, undefined, undefined, 'info'),
    );

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryDto;

    expect(payload).toHaveProperty('owner');
    expect(typeof payload.owner).toBe('string');
    expect(payload.owner).toBe(users[0]);

    expect(payload).toHaveProperty('title');
    expect(typeof payload.title).toBe('string');
    expect(payload.title).toBe(ROOT_CATEGORY_TITLE);

    expect(payload).toHaveProperty('id');
    expect(typeof payload.id).toBe('string');
    expect(payload.id).toBe(rootCategory.id);
  });

  it('/categories (POST) - Forbidden to create category', async () => {
    const data: CreateCategoryDto = {
      title: 'category1',
      parentLocation: rootCategory.location,
      description: 'something',
      allowedTopicTypes: [TopicTypes.TAKE_AND_COMPLETE, TopicTypes.DISCUSSION],
      permissions: {
        categoriesGranted: [],
        categoriesRevoked: [],
        topicsGranted: [],
        topicsRevoked: [],
      },
    };

    const result = await app.inject(
      getRequestParams('POST', undefined, users[1], data),
    );

    expect(result.statusCode).toBe(403);

    // TODO add template check
  });

  it('/categories (POST) - Should create category', async () => {
    const data: CreateCategoryDto = {
      title: 'category1',
      parentLocation: rootCategory.location,
      description: 'something',
      allowedTopicTypes: [TopicTypes.TAKE_AND_COMPLETE, TopicTypes.DISCUSSION],
      permissions: {
        categoriesGranted: [],
        categoriesRevoked: [],
        topicsGranted: [],
        topicsRevoked: [],
      },
    };

    const result = await app.inject(
      getRequestParams('POST', undefined, users[0], data),
    );

    expect(result.statusCode).toBe(201);
  });

  it('/categories (GET) - Should return new nested category', async () => {
    const result = await app.inject(getRequestParams('GET'));

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryFullInfoDto;

    expect(payload).toHaveProperty('category');
    expect(typeof payload.category).toBe('object');

    const category = payload.category;

    expect(category).toHaveProperty('owner');
    expect(typeof category.owner).toBe('string');
    expect(category.owner).toBe(users[0]);

    expect(category).toHaveProperty('title');
    expect(typeof category.title).toBe('string');
    expect(category.title).toBe(ROOT_CATEGORY_TITLE);

    expect(category).toHaveProperty('id');
    expect(typeof category.id).toBe('string');

    rootCategory = category;

    expect(payload).toHaveProperty('nestedCategories');
    expect(payload.nestedCategories).toBeInstanceOf(Array);
    expect(payload.nestedCategories.length).toBe(1);

    cat1 = payload.nestedCategories[0];

    expect(cat1.title).toBe('category1');
    expect(cat1.description).toBe('something');
    expect(cat1.owner).toBe(users[0]);
    expect(cat1.parent).toBe(rootCategory.id);
    expect(cat1.location).toBeDefined();
    expect(cat1.isPinned).toBe(false);
    expect(cat1.isDeleted).toBe(false);
    expect(cat1.allowedTopicTypes).toStrictEqual([
      TopicTypes.TAKE_AND_COMPLETE,
      TopicTypes.DISCUSSION,
    ]);

    expect(cat1.subscribedUsers).toStrictEqual([]);
    expect(cat1.pinHistory).toStrictEqual([]);
    expect(cat1.deleteHistory).toStrictEqual([]);

    const categoryPermissions = cat1.permissions;
    expect(categoryPermissions).toBeInstanceOf(Object);
    expect(categoryPermissions).toHaveProperty('categoriesGranted');
    expect(categoryPermissions).toHaveProperty('categoriesRevoked');
    expect(categoryPermissions).toHaveProperty('topicsGranted');
    expect(categoryPermissions).toHaveProperty('topicsRevoked');

    expect(categoryPermissions.categoriesGranted).toStrictEqual([]);
    expect(categoryPermissions.categoriesRevoked).toStrictEqual([]);
    expect(categoryPermissions.topicsGranted).toStrictEqual([]);
    expect(categoryPermissions.topicsRevoked).toStrictEqual([]);
  });

  it('/categories/:id (GET) - Should return created category', async () => {
    const result = await app.inject(getRequestParams('GET', cat1.id));

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryFullInfoDto;

    expect(payload).toHaveProperty('category');
    expect(typeof payload.category).toBe('object');

    const category = payload.category;

    expect(category).toHaveProperty('owner');
    expect(typeof category.owner).toBe('string');
    expect(category.owner).toBe(users[0]);

    expect(category).toHaveProperty('title');
    expect(typeof category.title).toBe('string');
    expect(category.title).toBe(cat1.title);

    expect(category).toHaveProperty('description');
    expect(typeof category.description).toBe('string');
    expect(category.description).toBe(cat1.description);

    expect(category).toHaveProperty('id');
    expect(typeof category.id).toBe('string');
    expect(category.id).toBe(cat1.id);

    expect(payload).toHaveProperty('nestedCategories');
    expect(payload.nestedCategories).toStrictEqual([]);
  });

  it('/categories/:id/info (GET) - Should return created category info', async () => {
    const result = await app.inject(
      getRequestParams('GET', cat1.id, undefined, undefined, 'info'),
    );

    expect(result.statusCode).toBe(200);
    const payload = JSON.parse(result.payload) as CategoryDto;

    expect(payload).toHaveProperty('owner');
    expect(typeof payload.owner).toBe('string');
    expect(payload.owner).toBe(users[0]);

    expect(payload).toHaveProperty('title');
    expect(typeof payload.title).toBe('string');
    expect(payload.title).toBe(cat1.title);

    expect(payload).toHaveProperty('title');
    expect(typeof payload.description).toBe('string');
    expect(payload.description).toBe(cat1.description);

    expect(payload).toHaveProperty('id');
    expect(typeof payload.id).toBe('string');
    expect(payload.id).toBe(cat1.id);
  });

  afterAll(async () => {
    await closeMemoryServerConnection();
    await app.close();
  });
});
