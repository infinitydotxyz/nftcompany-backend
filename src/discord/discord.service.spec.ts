import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';

describe('DiscordService', () => {
  let service: DiscordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscordService]
    }).compile();

    service = module.get<DiscordService>(DiscordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get the stats from the invite successfully', async () => {
    const baycInvite = 'https://discord.gg/3P5K3dzgdB';
    try {
      const stats = await service.getGuildStats(baycInvite);
      expect(stats).toBeDefined();
    } catch (err) {
      expect(err).toBeUndefined();
    }
  });
});
