import { sleep } from 'utils';
import { firestore } from 'container';
import { error } from '@infinityxyz/lib/utils';

const MAX_SIZE = 500;

interface Batch {
  batch: FirebaseFirestore.WriteBatch;
  size: number;
}

export default class FirestoreBatchHandler {
  private currentBatch: Batch;

  constructor() {
    this.currentBatch = this.newBatch();
  }

  get size(): number {
    return this.currentBatch.size;
  }

  add(
    doc: FirebaseFirestore.DocumentReference,
    object: Partial<FirebaseFirestore.DocumentData>,
    options: FirebaseFirestore.SetOptions
  ): void {
    if (this.currentBatch.size >= MAX_SIZE) {
      this.flush().catch((err) => {
        error(err);
        throw err;
      });
    }

    this.currentBatch.batch.set(doc, object, options);
    this.currentBatch.size += 1;
  }

  async flush(): Promise<void> {
    if (this.currentBatch.size > 0) {
      const maxAttempts = 3;
      let attempt = 0;
      const batch = this.currentBatch.batch;
      this.currentBatch = this.newBatch();
      while (true) {
        attempt += 1;
        try {
          await batch.commit();
          return;
        } catch (err) {
          // Logger.error('Failed to commit batch', err);
          if (attempt > maxAttempts) {
            error(`Failed to commit batch`);
            throw err;
          }
          await sleep(1000); // Firebase has a limit of 1 write per doc per second
        }
      }
    }
  }

  private newBatch(): Batch {
    return {
      batch: firestore.db.batch(),
      size: 0
    };
  }
}
