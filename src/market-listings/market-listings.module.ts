import { Module } from '@nestjs/common';
import { MarketListingsController } from './market-listings.controller';

@Module({
  controllers: [MarketListingsController]
})
export class MarketListingsModule {}
