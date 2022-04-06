import { Test, TestingModule } from '@nestjs/testing';
import { MarketListingsController } from './market-listings.controller';

describe('MarketListingsController', () => {
  let controller: MarketListingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketListingsController],
    }).compile();

    controller = module.get<MarketListingsController>(MarketListingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
