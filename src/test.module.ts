import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { FirebaseModule } from './firebase/firebase.module';

/**
 * This module imports all global dependencies that you'll need for tests to succeed.
 * To be used for testing ONLY!
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, '../.env'),
      isGlobal: true
    }),
    FirebaseModule.forRootTest()
  ],
  controllers: [],
  providers: []
})
export class TestModule {}
