import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from 'test.module';
import { MnemonicService } from './mnemonic.service';

describe('MnemonicService', () => {
  let service: MnemonicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
      providers: [MnemonicService]
    }).compile();

    service = module.get<MnemonicService>(MnemonicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a list of top owners', async () => {
    const bayc = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d';
    try {
      const response = await service.getTopOwners(bayc);
      expect(response).toBeDefined();
    } catch (err) {
      expect(err).toBeUndefined();
    }
  });
});
