import { Module } from '@nestjs/common';
import { MnemonicService } from './mnemonic.service';

@Module({
  providers: [MnemonicService],
  exports: [MnemonicService]
})
export class MnemonicModule {}
