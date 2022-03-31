import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from 'logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { StatsModule } from './stats/stats.module';
import * as serviceAccount from './creds/nftc-dev-firebase-creds.json';
import { join } from 'path';
import { TwitterModule } from './twitter/twitter.module';
import { DiscordModule } from './discord/discord.module';
import { UserModule } from './user/user.module';
import { CollectionsModule } from 'collections/collections.module';
import { VotesService } from './votes/votes.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, '../.env'),
      isGlobal: true
    }),
    FirebaseModule.forRoot({
      cert: serviceAccount
    }),
    CollectionsModule,
    TwitterModule,
    DiscordModule,
    StatsModule,
    UserModule
  ],
  controllers: [AppController],
  providers: [AppService, VotesService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
