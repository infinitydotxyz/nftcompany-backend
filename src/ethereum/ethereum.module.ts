import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthereumService } from './ethereum.service';

@Module({
  providers: [EthereumService],
  imports: [ConfigModule],
  exports: [EthereumService]
})
export class EthereumModule {}
