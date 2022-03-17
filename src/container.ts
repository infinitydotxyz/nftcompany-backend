// import Firestore from './databases/Firestore';
import { container } from 'tsyringe';

class Firestore {}

/**
 * hack to make this not complain
 */
export const firestore: any = container.resolve(Firestore);
