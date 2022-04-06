import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { auth, INFINITY_EMAIL, INFINITY_URL, ORIGIN } from './constants';
import { HttpExceptionFilter } from './http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import listingsRouter from './routes/listings';

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

  /**
   * Unconverted routes needed for FE development
   *
   * Only register the specific route that you need
   */
  app.use('/listings', listingsRouter);

  setupSwagger(app, 'docs');
}

function setupSwagger(app: INestApplication, path: string) {
  const config = new DocumentBuilder()
    .setTitle('Infinity API')
    .setDescription('Developer API')
    .setContact('infinity', INFINITY_URL, INFINITY_EMAIL)
    .setVersion('1.0.0')
    .addSecurity(auth.signature, {
      type: 'apiKey',
      scheme: `${auth.signature}: <user signed message>`,
      name: auth.signature,
      in: 'header',
      description: `Pass the user signed messaged in the ${auth.signature} header`
    })
    .addSecurity(auth.message, {
      type: 'apiKey',
      scheme: `${auth.message}: <original message>`,
      name: auth.message,
      in: 'header',
      description: `Pass the message that was signed in the ${auth.message} header`
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

void bootstrap();
