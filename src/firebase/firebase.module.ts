import { FirebaseService } from './firebase.service';
import { DynamicModule, Module } from '@nestjs/common';
import { FirebaseModuleOptions } from './firebase.types';
import { FIREBASE_OPTIONS } from './firebase.constants';

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
}
