import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsModule } from 'collections/collections.module';
import { DiscordModule } from 'discord/discord.module';
import { StatsModule } from 'stats/stats.module';
import { StorageModule } from 'storage/storage.module';
import { TestModule } from 'test.module';
import { TwitterModule } from 'twitter/twitter.module';
import { VotesModule } from 'votes/votes.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, StatsModule, VotesModule, CollectionsModule, StorageModule, DiscordModule, TwitterModule],
      controllers: [UserController],
      providers: [UserService]
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
