import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsModule } from 'collections/collections.module';
import { TestModule } from 'test.module';
import { NftsService } from './nfts.service';

describe('NftService', () => {
  let service: NftsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, CollectionsModule],
      providers: [NftsService]
    }).compile();

    service = module.get<NftsService>(NftsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
