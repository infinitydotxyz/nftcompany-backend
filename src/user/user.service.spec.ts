import { Test, TestingModule } from '@nestjs/testing';
import { StatsModule } from 'stats/stats.module';
import { TestModule } from 'test.module';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule, StatsModule],
      providers: [UserService]
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
