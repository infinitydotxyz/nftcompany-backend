import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from 'logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollectionModule } from './collection/collection.module';
import { ConfigModule } from '@nestjs/config';
import firebaseConfig from './config/firebase.config';
import nodemailerConfig from 'config/nodemailer.config';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [firebaseConfig('nftc-dev'), nodemailerConfig('nftc-dev')]
    }),
    CollectionModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
