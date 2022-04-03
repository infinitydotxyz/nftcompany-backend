import { Test, TestingModule } from '@nestjs/testing';
import { EtherscanModule } from 'etherscan/etherscan.module';
import { StatsModule } from 'stats/stats.module';
import { TwitterModule } from 'twitter/twitter.module';
import { VotesModule } from 'votes/votes.module';
import { CollectionsController } from './collections.controller';
import CollectionsService from './collections.service';
import { TestModule } from 'test.module';

describe('CollectionController', () => {
  let controller: CollectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, StatsModule, VotesModule, TwitterModule, EtherscanModule],
      controllers: [CollectionsController],
      providers: [CollectionsService]
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
