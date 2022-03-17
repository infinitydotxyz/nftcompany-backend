import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import BaseFirebase from './firebase.base';

@Injectable()
export default class NodemailerFirebaseProvider extends BaseFirebase {
  constructor(protected configService: ConfigService) {
    super(configService, 'nodemailer');
  }
}
