import mongoose from 'mongoose';
import { Logger } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { NodeEnvTypes } from '../enums';
import { config } from '../../config';

const { nodeEnv, mongodbUrl } = config;

let mongoMemoryReplSet: MongoMemoryReplSet;

const initMemoryServer = async (): Promise<string> => {
  mongoMemoryReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });

  await mongoMemoryReplSet.waitUntilRunning();

  return mongoMemoryReplSet.getUri();
};

export const getMongoUri = async (): Promise<string> => {
  if (nodeEnv === NodeEnvTypes.TEST) {
    return initMemoryServer();
  }

  if (nodeEnv === NodeEnvTypes.DEVELOPMENT) {
    mongoose.set('debug', true);
  }

  if (mongodbUrl) {
    return mongodbUrl;
  }

  new Logger('MongooseModule').warn(
    'MongoDb URI not set in env file. Will use temporary MongoMemoryServer.',
  );

  return initMemoryServer();
};

export const closeMemoryServerConnection = async (): Promise<void> => {
  if (mongoMemoryReplSet) {
    jest.spyOn(console, 'warn').mockImplementation((message) => {
      if (message.includes('ECONNRESET')) return;
      console.warn(message);
    });

    await mongoMemoryReplSet.stop();

    jest.restoreAllMocks();
  }
};
