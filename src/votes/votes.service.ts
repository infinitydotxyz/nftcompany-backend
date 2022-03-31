import { Injectable } from '@nestjs/common';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import { FirebaseService } from 'firebase/firebase.service';

@Injectable()
export class VotesService {
  constructor(private firebaseService: FirebaseService) {}

  async getCollectionVotes(collection: ParsedCollectionId) {
    // TODO
    // Const
  }

  async saveVote() {
    // TODO
  }

  async getUserVotes() {
    // TODO
  }
}
