import { config as loadEnv } from 'dotenv';
loadEnv();
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { INFINITY_EMAIL, INFINITY_URL, ORIGIN } from './constants';
import { HttpExceptionFilter } from './http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

function setup(app: INestApplication) {
  app.enableCors({
    origin: ORIGIN,
    optionsSuccessStatus: 200
  });
  app.use(helmet());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip validated object of any properties that do not use any validation decorators
      transform: true
    })
  );

  setupSwagger(app, 'docs');
}

function setupSwagger(app: INestApplication, path: string) {
  const config = new DocumentBuilder()
    .setTitle('Infinity API')
    .setDescription('Developer API')
    .setContact('infinity', INFINITY_URL, INFINITY_EMAIL)
    .setVersion('1.0.0')
    .addSecurity('signature', {
      type: 'apiKey',
      scheme: 'x-auth-signature: <user signed message>, x-auth-message: <original message>',
      name: 'x-auth-signature',
      in: 'header',
      description:
        'Pass the user signed messaged in the x-auth-signature header and the message that was signed in the x-auth-message header'
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(path, app, document);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setup(app);
  await app.listen(process.env.PORT || 9090);
}

bootstrap();
