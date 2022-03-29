import { ChainId, OrderDirection, StatsPeriod } from '@infinityxyz/lib/types/core';
import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from '../firebase/firebase.service';
import { StatsService } from './stats.service';
import { DiscordService } from 'discord/discord.service';
import { TwitterService } from 'twitter/twitter.service';
import * as serviceAccount from '../creds/nftc-dev-firebase-creds.json';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import RankingsRequestDto from 'collection/dto/rankings-query.dto';
import { StatType } from './stats.types';

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
      address: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
      chainId: ChainId.Mainnet
    });
    const stats = await service.getCurrentSocialsStats(bayc);
    console.log(stats);
    expect(stats).toBeDefined();
  });

  it('should return combined stats', async () => {
    const query: RankingsRequestDto = {
      period: StatsPeriod.All,
      date: 1648069200000,
      orderBy: StatType.DiscordFollowers,
      orderDirection: OrderDirection.Descending,
      limit: 50
    };
    try {
      const stats = await service.getCollectionRankings(query);
      console.log(stats);
      expect(stats).toBeDefined();
    } catch (err) {
      console.error(err);
      expect(err).toBeUndefined();
    }
  });
});
