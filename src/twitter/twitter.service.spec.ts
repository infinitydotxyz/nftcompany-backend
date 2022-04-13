import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from 'test.module';
import { TwitterService } from './twitter.service';

describe('TwitterService', () => {
  let service: TwitterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error(err);
      expect(err).toBeUndefined();
    }
  });
});
