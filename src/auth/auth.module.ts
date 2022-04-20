import { DynamicModule, Module } from '@nestjs/common';
import { ParseUserIdPipe } from 'user/user-id.pipe';
import { AuthGuard } from './auth.guard';

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      global: true,
      module: AuthModule,
      providers: [AuthGuard, ParseUserIdPipe],
      exports: [AuthGuard, ParseUserIdPipe]
    };
  }
}
