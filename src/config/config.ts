import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';

import { AppConfig } from './config.dto';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { NodeEnvTypes } from '../common/enums';

dotenvConfig();

const nodeEnv = process.env.NODE_ENV || 'production';
if (nodeEnv === NodeEnvTypes.DEVELOPMENT || nodeEnv === NodeEnvTypes.TEST) {
  const envFilePath = path.resolve(__dirname, `../../.env.${nodeEnv}`);
  dotenvConfig({ path: envFilePath, override: true });
}

const appConfig: AppConfig = {
  nodeEnv,
  title: process.env.npm_package_name || 'Authorization API',
  version: process.env.npm_package_version || '1.0.0',
  description: process.env.npm_package_description || 'Authorization API',
  port: parseInt(process.env.PORT || '3000', 10),
  ip: process.env.IP,
  grpcUrl: process.env.GRPC_URL || '',
  mongodbUrl: process.env.MONGODB_URL,
  otlpCollectorUrl: process.env.OTLP_COLLECTOR_URL || '',
};

const validatedConfig = plainToClass(AppConfig, appConfig);
const errors = validateSync(validatedConfig, {
  skipMissingProperties: false,
});

if (errors.length > 0) {
  throw new Error(`Configuration validation failed: ${errors}`);
}

export { validatedConfig as config };
