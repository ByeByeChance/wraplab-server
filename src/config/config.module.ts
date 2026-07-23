import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),

        // Database
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(3306),
        DB_USERNAME: Joi.string().default('root'),
        DB_PASSWORD: Joi.string().allow('').default(''),
        DB_DATABASE: Joi.string().default('wraplab'),

        // Redis
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
        REDIS_DB: Joi.number().default(0),

        // JWT
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.number().default(7200),
        JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),

        // Bcrypt
        BCRYPT_SALT_ROUNDS: Joi.number().default(12),

        // OSS
        OSS_ENDPOINT: Joi.string().allow('').default(''),
        OSS_BUCKET: Joi.string().allow('').default(''),
        OSS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
        OSS_ACCESS_KEY_SECRET: Joi.string().allow('').default(''),
        OSS_REGION: Joi.string().default('oss-cn-hangzhou'),
        OSS_CDN_DOMAIN: Joi.string().allow('').default(''),

        // File
        UPLOAD_IMAGE_MAX_SIZE: Joi.number().default(10485760),
        UPLOAD_MODEL_MAX_SIZE: Joi.number().default(52428800),
        UPLOAD_DIR: Joi.string().default('./uploads'),

        // Pricing
        DEFAULT_FULL_CAR_AREA_M2: Joi.number().default(15),

        // CORS
        CLIENT_ORIGIN: Joi.string().default('http://localhost:10086'),
        ADMIN_ORIGIN: Joi.string().default('http://localhost:3001'),

        // Throttle
        THROTTLE_TTL: Joi.number().default(60000),
        THROTTLE_LIMIT: Joi.number().default(10),
      }),
    }),
  ],
})
export class ConfigModule {}
