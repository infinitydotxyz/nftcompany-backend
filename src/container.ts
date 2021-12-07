import Firestore from './databases/Firestore.js';
import { container } from 'tsyringe';

export const firestore: Firestore = container.resolve(Firestore);
