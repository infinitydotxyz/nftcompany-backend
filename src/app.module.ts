import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from 'logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollectionModule } from './collection/collection.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import serviceAccountLoader from 'config/service-account-loader';
import { ServiceAccount } from 'firebase-admin';

export type ServiceAccountNames = 'firebase' | 'nodemailer';
export type ServiceAccounts = Record<ServiceAccountNames, ServiceAccount>;
export type ConfigServiceType = ConfigService<ServiceAccounts>;

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [
        serviceAccountLoader('nftc-dev', '-firebase-creds.json', 'firebase'),
        serviceAccountLoader('nftc-dev', '-nodemailer-creds.json', 'nodemailer')
      ],
      isGlobal: true
    }),
    CollectionModule,
    FirebaseModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
