import Firestore from './databases/Firestore';
import { container } from 'tsyringe';

export const firestore: any = container.resolve(Firestore);
