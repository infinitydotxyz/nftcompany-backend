import { Global, Module } from '@nestjs/common';
import { UserModule } from 'user/user.module';
import { UserParserService } from './parser.service';

@Global()
@Module({
  providers: [UserParserService],
  exports: [UserParserService],
  imports: [UserModule]
})
export class UserParserModule {}
