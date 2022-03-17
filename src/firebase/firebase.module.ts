import { Module } from '@nestjs/common';
import NodemailerFirebaseProvider from './nodemailer.provider';
import DefaultFirebaseProvider from './default.firebase.provider';

@Module({
  providers: [DefaultFirebaseProvider, NodemailerFirebaseProvider],
  exports: [DefaultFirebaseProvider, NodemailerFirebaseProvider]
})
export class FirebaseModule {}
