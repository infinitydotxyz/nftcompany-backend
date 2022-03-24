// Import Firestore from './databases/Firestore';
import { container } from 'tsyringe';

class Firestore {}

/**
 * Hack to make this not complain
 */
export const firestore: any = container.resolve(Firestore);
