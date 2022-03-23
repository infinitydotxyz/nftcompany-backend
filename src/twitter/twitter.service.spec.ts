import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'path';
import { TwitterService } from './twitter.service';

describe('TwitterService', () => {
  let service: TwitterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: join(__dirname, '../../.env'),
          isGlobal: true
        })
      ],
      providers: [TwitterService]
    }).compile();

    service = module.get<TwitterService>(TwitterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get verified mentions for bayc', async () => {
    try {
      const { account, tweets } = await service.getAccountAndMentions('BoredApeYC');
      expect(tweets.length).toBeGreaterThan(0);
      expect(account.followersCount).toBeGreaterThan(100_000);
    } catch (err) {
      console.error(err);
      expect(err).toBeUndefined();
    }
  });

  it('should get the account but no verified mentions', async () => {
    try {
      const username = 'jfrazier_eth';
      const { account, tweets } = await service.getAccountAndMentions(username);
      expect(tweets.length).toBe(0);
      expect(account).toBeDefined();
    } catch (err) {
      console.error(err);
      expect(err).toBeUndefined();
    }
  });
});
