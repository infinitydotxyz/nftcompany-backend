import Firestore from './databases/Firestore';
import { container } from 'tsyringe';

export const firestore: Firestore = container.resolve(Firestore);
