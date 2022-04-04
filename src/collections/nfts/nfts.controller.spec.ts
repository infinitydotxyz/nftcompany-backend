import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsModule } from 'collections/collections.module';
import CollectionsService from 'collections/collections.service';
import { TestModule } from 'test.module';
import { NftsController } from './nfts.controller';
import { NftsService } from './nfts.service';

describe('NftsController', () => {
  let controller: NftsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, CollectionsModule],
      controllers: [NftsController],
      providers: [NftsService, CollectionsService]
    }).compile();

    controller = module.get<NftsController>(NftsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
