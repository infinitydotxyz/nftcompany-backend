import { FirebaseService } from './firebase.service';
import { DynamicModule, Module } from '@nestjs/common';
import { FirebaseModuleOptions } from './firebase.types';
import { FIREBASE_OPTIONS } from './firebase.constants';
import * as serviceAccount from '../creds/nftc-dev-firebase-creds.json';

@Module({})
export class FirebaseModule {
  static forRoot(options: FirebaseModuleOptions): DynamicModule {
    return {
      global: true,
      module: FirebaseModule,
      providers: [
        {
          provide: FIREBASE_OPTIONS,
          useValue: options
        },
        FirebaseService
      ],
      exports: [FirebaseService]
    };
  }

  static forRootTest() {
    return FirebaseModule.default();
  }

  static default() {
    return FirebaseModule.forRoot({
      cert: serviceAccount
    });
  }
}
