import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import BaseFirebase from './firebase.base';

@Injectable()
export default class DefaultFirebaseProvider extends BaseFirebase {
  constructor(protected configService: ConfigService) {
    super(configService, 'firebase');
    console.log(this);
  }
}
