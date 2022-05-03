import { Global, Module } from '@nestjs/common';
import { AlchemyModule } from 'alchemy/alchemy.module';
import { UserModule } from 'user/user.module';
import { UserParserService } from './parser.service';

@Global()
@Module({
  providers: [UserParserService],
  exports: [UserParserService],
  imports: [UserModule, AlchemyModule]
})
export class UserParserModule {}
