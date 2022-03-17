import { config as loadEnv } from 'dotenv';
loadEnv();
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { INFINITY_EMAIL, INFINITY_URL, ORIGIN } from './constants';
import { HttpExceptionFilter } from './http-exception.filter';
import { logger } from './logger.middleware';

function setup(app: INestApplication) {
  app.enableCors({
    origin: ORIGIN,
    optionsSuccessStatus: 200
  });
  app.use(helmet());
  app.use(logger);
  app.useGlobalFilters(new HttpExceptionFilter());

  setupSwagger(app, 'docs');
}

function setupSwagger(app: INestApplication, path: string) {
  const config = new DocumentBuilder()
    .setTitle('Infinity API')
    .setDescription('Developer API')
    .setContact('infinity', INFINITY_URL, INFINITY_EMAIL)
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(path, app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setup(app);
  await app.listen(process.env.PORT || 9090);
}

bootstrap();
