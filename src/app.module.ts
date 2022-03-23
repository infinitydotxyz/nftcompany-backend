import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from 'logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CollectionModule } from './collection/collection.module';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { StatsModule } from './stats/stats.module';
import { DiscordService } from './discord/discord.service';
import { TwitterService } from './twitter/twitter.service';
import * as serviceAccount from './creds/nftc-dev-firebase-creds.json';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    }),
    FirebaseModule.forRoot({
      cert: serviceAccount
    }),
    CollectionModule,
    StatsModule
  ],
  controllers: [AppController],
  providers: [AppService, DiscordService, TwitterService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
