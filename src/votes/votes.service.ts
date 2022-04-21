import { CreationFlow, OrderDirection } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { randomInt } from 'crypto';
import { FirebaseService } from 'firebase/firebase.service';
import { UserDto } from 'user/dto/user.dto';
import { base64Decode, base64Encode } from 'utils';
import { CollectionVotesDto } from './dto/collection-votes.dto';
import { UserCollectionVoteDto } from './dto/user-collection-vote.dto';
import { UserCollectionVotesArrayDto } from './dto/user-collection-votes-array.dto';
import { UserCollectionVotesQuery } from './dto/user-collection-votes-query.dto';
import { collectionVotesShards } from './votes.constants';

@Injectable()
export class VotesService {
  private static getVoteDocId(user: UserDto) {
    return `${user.userChainId}:${user.userAddress}`;
  }

  private static getShardDocId(shardNumber: number) {
    return `shard-${shardNumber}`;
  }

  constructor(private firebaseService: FirebaseService) {}

  async getCollectionVotes(collection: ParsedCollectionId): Promise<CollectionVotesDto> {
    const shardsSnapshot = await collection.ref.collection(firestoreConstants.COLLECTION_VOTES_SHARDS_COLL).get();

    const shards = shardsSnapshot.docs.map((item) => item.data() as CollectionVotesDto);
    const totalVotes = shards.reduce(
      (acc, cur) => ({
        ...acc,
        votesFor: acc.votesFor + cur.votesFor ?? 0,
        votesAgainst: acc.votesAgainst + cur.votesAgainst ?? 0
      }),
      { votesFor: 0, votesAgainst: 0, collectionAddress: collection.address, collectionChainId: collection.chainId }
    );

    return totalVotes;
  }

  async saveUserCollectionVote(vote: UserCollectionVoteDto): Promise<void> {
    const collectionRef = await this.firebaseService.getCollectionRef({
      chainId: vote.collectionChainId,
      address: vote.collectionAddress
    });

    const collection = (await collectionRef.get()).data();
    if (collection?.state?.create?.step !== CreationFlow.Complete) {
      throw new InvalidCollectionError(
        vote.collectionAddress,
        vote.collectionChainId,
        'Collection is not fully indexed'
      );
    }

    await this.firebaseService.firestore.runTransaction(async (tx) => {
      const userVoteDoc = collectionRef
        .collection(firestoreConstants.COLLECTION_VOTES_COLL)
        .doc(VotesService.getVoteDocId(vote));

      const currentVote = await tx.get(userVoteDoc);
      const randomShardNumber = randomInt(collectionVotesShards.numShards);
      const shardDocId = VotesService.getShardDocId(randomShardNumber);
      const shard = collectionRef.collection(firestoreConstants.COLLECTION_VOTES_SHARDS_COLL).doc(shardDocId);

      const shardSnapshot = await tx.get(shard);

      let shardData = shardSnapshot.data() as CollectionVotesDto;
      if (!shardData) {
        // Init shard
        const initialShard: CollectionVotesDto = {
          votesFor: 0,
          votesAgainst: 0,
          collectionAddress: vote.collectionAddress,
          collectionChainId: vote.collectionChainId
        };
        shardData = initialShard;
        tx.set(shard, initialShard); // Create shard
      }

      if (!currentVote.exists) {
        // Save and increment only
        tx.set(userVoteDoc, vote);
        tx.update(shard, {
          ...shardData,
          votesFor: this.firebaseService.firestoreNamespace.FieldValue.increment(vote.votedFor ? 1 : 0),
          votesAgainst: this.firebaseService.firestoreNamespace.FieldValue.increment(vote.votedFor ? 0 : 1)
        });
        return;
      }

      const currentVoteData = currentVote.data() as UserCollectionVoteDto;
      if (currentVoteData.votedFor === vote.votedFor) {
        return; // No reason to update
      }

      tx.set(userVoteDoc, vote);
      tx.update(shard, {
        votesFor: this.firebaseService.firestoreNamespace.FieldValue.increment(vote.votedFor ? 1 : -1),
        votesAgainst: this.firebaseService.firestoreNamespace.FieldValue.increment(vote.votedFor ? -1 : 1)
      });
    });
  }

  async getUserVotes(user: UserDto, options: UserCollectionVotesQuery): Promise<UserCollectionVotesArrayDto> {
    const votesGroup = this.firebaseService.firestore.collectionGroup(firestoreConstants.COLLECTION_VOTES_COLL);
    const orderDirection = options.orderDirection ?? OrderDirection.Descending;
    let votesQuery = votesGroup
      .where('userAddress', '==', user.userAddress)
      .where('userChainId', '==', user.userChainId)
      .orderBy('updatedAt', orderDirection);

    const decodedCursor = parseInt(base64Decode(options.cursor), 10);
    if (!Number.isNaN(decodedCursor)) {
      votesQuery = votesQuery.startAfter(decodedCursor);
    }

    const limit = options?.limit ?? FirebaseService.DEFAULT_ITEMS_PER_PAGE;
    votesQuery = votesQuery.limit(limit + 1);
    const votesSnapshot = await votesQuery.get();
    const votes = votesSnapshot.docs.map((item) => item.data() as UserCollectionVoteDto);

    const hasNextPage = votes.length > limit;

    if (hasNextPage) {
      votes.pop();
      votesSnapshot.docs.pop();
    }

    const rawCursor = votes?.[votes?.length - 1]?.updatedAt;
    const cursor = rawCursor ? base64Encode(`${rawCursor}`) : '';

    return {
      data: votes,
      hasNextPage,
      cursor
    };
  }

  async getUserVote(user: UserDto, collection: ParsedCollectionId): Promise<UserCollectionVoteDto | null> {
    const userVoteRef = collection.ref
      .collection(firestoreConstants.COLLECTION_VOTES_COLL)
      .doc(VotesService.getVoteDocId(user));

    const userVoteSnapshot = await userVoteRef.get();

    if (!userVoteSnapshot.exists) {
      return null;
    }

    return userVoteSnapshot.data() as UserCollectionVoteDto;
  }
}
