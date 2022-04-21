import { Global, Module } from '@nestjs/common';
import { UserParserModule } from 'user/parser/parser.module';
import { UserParserService } from 'user/parser/parser.service';
/**
 * Global authentication module.
 *
 * This module re-exports the dependencies that are required in `AuthGuard`.
 */
@Global()
@Module({
  providers: [UserParserService],
  exports: [UserParserService],
  imports: [UserParserModule]
})
export class AuthModule {}
