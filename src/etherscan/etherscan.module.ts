import { EtherscanService } from './etherscan.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [EtherscanService],
  exports: [EtherscanService]
})
export class EtherscanModule {}
