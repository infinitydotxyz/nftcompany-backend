import { Global, Module } from '@nestjs/common';
import { ParseUserIdPipe } from 'user/user-id.pipe';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  providers: [AuthGuard, ParseUserIdPipe],
  exports: [AuthGuard, ParseUserIdPipe]
})
export class AuthModule {}
