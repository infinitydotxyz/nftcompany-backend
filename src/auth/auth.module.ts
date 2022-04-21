import { Global, Module } from '@nestjs/common';
import { UserModule } from 'user/user.module';
import { UserService } from 'user/user.service';

/**
 * Global authentication module.
 *
 * This module re-exports the dependencies that are required in `AuthGuard`.
 */
@Global()
@Module({
  providers: [UserService],
  exports: [UserService],
  imports: [UserModule]
})
export class AuthModule {}
