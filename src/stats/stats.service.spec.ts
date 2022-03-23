import { ChainId } from '@infinityxyz/lib/types/core';
import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from '../firebase/firebase.service';
import { StatsService } from './stats.service';
import { DiscordService } from 'discord/discord.service';
import { TwitterService } from 'twitter/twitter.service';
import * as serviceAccount from '../creds/nftc-dev-firebase-creds.json';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

describe('StatsService', () => {
  let service: StatsService;
  let firebaseService: FirebaseService;
  let firebaseProvider;
  beforeAll(async () => {
    firebaseProvider = {
      provide: FirebaseService,
      useValue: new FirebaseService({ cert: serviceAccount })
    };
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: join(__dirname, '../../.env'),
          isGlobal: true
        })
      ],
      providers: [firebaseProvider, StatsService, DiscordService, TwitterService]
    }).compile();

    service = module.get<StatsService>(StatsService);
    firebaseService = module.get<FirebaseService>(FirebaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return some stats', async () => {
    const bayc = await firebaseService.getCollectionRef({
      address: '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
      chainId: ChainId.Mainnet
    });
    const stats = await service.getCurrentSocialsStats(bayc);
    console.log(stats);
    expect(stats).toBeDefined();
  });
});
