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
});
