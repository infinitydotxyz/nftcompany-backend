import { OrderDirection } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { FirebaseService } from 'firebase/firebase.service';
import { StatsService } from 'stats/stats.service';
import { UserFollowingCollection } from 'user/dto/user-following-collection.dto';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private firebaseService: FirebaseService, private statsService: StatsService) {}

  async getUserWatchlist(user: UserDto, query: RankingsRequestDto) {
    const collectionFollows = this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(`${user.userChainId}:${user.userAddress}`)
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL)
      .select('address', 'chainId');
    const snap = await collectionFollows.get();
    const collections = snap.docs.map((doc) => {
      const { chainId, address } = doc.data();
      return { chainId, address };
    });

    const statsPromises = collections.map((collection) =>
      this.statsService.getCollectionStats(collection, { period: query.period, date: query.date })
    );

    const stats = await Promise.all(statsPromises);

    const orderedStats = stats.sort((itemA, itemB) => {
      const statA = itemA[query.orderBy];
      const statB = itemB[query.orderBy];
      const isAsc = query.orderDirection === OrderDirection.Ascending;
      return isAsc ? statA - statB : statB - statA;
    });

    return orderedStats;
  }

  async getUserFollowingCollections() {
    const collectionFollows = this.firebaseService.firestore
      .collection(firestoreConstants.USER_FOLLOWS_COLL);

    const snap = await collectionFollows.get();
    const followingCollections: UserFollowingCollection[] = snap.docs.map((doc: any) => {
      return { userAddress: '', collectionAddress: doc.collectionAddress, collectionChainId: doc.collectionChainId };
    });
    return followingCollections;
  }
}
