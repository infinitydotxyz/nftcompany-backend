import { CreationFlow, OrderDirection } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getEndCode } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { InvalidUserError } from 'common/errors/invalid-user.error';
import { FirebaseService } from 'firebase/firebase.service';
import { StatsService } from 'stats/stats.service';
import { UserFollowingCollection } from 'user/dto/user-following-collection.dto';
import { UserFollowingCollectionDeletePayload } from './dto/user-following-collection-delete-payload.dto';
import { UserFollowingCollectionPostPayload } from './dto/user-following-collection-post-payload.dto';
import { UserFollowingUserDeletePayload } from './dto/user-following-user-delete-payload.dto';
import { UserFollowingUserPostPayload } from './dto/user-following-user-post-payload.dto';
import { UserFollowingUser } from './dto/user-following-user.dto';
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

  async getUserFollowingCollections(user: UserDto) {
    const collectionFollows = this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL);

    const snap = await collectionFollows.get();
    const followingCollections: UserFollowingCollection[] = snap.docs.map((doc) => {
      const docData = doc.data() as UserFollowingCollection;
      return docData;
    });
    return followingCollections;
  }

  async addUserFollowingCollection(user: UserDto, payload: UserFollowingCollectionPostPayload) {
    const collectionRef = await this.firebaseService.getCollectionRef({
      chainId: payload.collectionChainId,
      address: payload.collectionAddress
    });

    const collection = (await collectionRef.get()).data();
    if (!collection) {
      throw new InvalidCollectionError(payload.collectionAddress, payload.collectionChainId, 'Collection not found');
    }
    if (collection?.state?.create?.step !== CreationFlow.Complete) {
      throw new InvalidCollectionError(
        payload.collectionAddress,
        payload.collectionChainId,
        'Collection is not fully indexed'
      );
    }

    await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL)
      .doc(payload.collectionChainId + ':' + payload.collectionAddress)
      .set({
        collectionAddress: payload.collectionAddress,
        collectionChainId: payload.collectionChainId,
        name: collection?.metadata?.name,
        slug: collection.slug,
        userAddress: user.userAddress
      });
    return {};
  }

  async removeUserFollowingCollection(user: UserDto, payload: UserFollowingCollectionDeletePayload) {
    const collectionRef = await this.firebaseService.getCollectionRef({
      chainId: payload.collectionChainId,
      address: payload.collectionAddress
    });

    const collection = (await collectionRef.get()).data();
    if (!collection) {
      throw new InvalidCollectionError(payload.collectionAddress, payload.collectionChainId, 'Collection not found');
    }
    if (collection?.state?.create?.step !== CreationFlow.Complete) {
      throw new InvalidCollectionError(
        payload.collectionAddress,
        payload.collectionChainId,
        'Collection is not fully indexed'
      );
    }

    await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL)
      .doc(payload.collectionChainId + ':' + payload.collectionAddress)
      .delete();
    return {};
  }

  async getUserFollowingUsers(user: UserDto) {
    const userFollows = this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.USER_FOLLOWS_COLL);

    const snap = await userFollows.get();
    const followingUsers: UserFollowingUser[] = snap.docs.map((doc) => {
      const docData = doc.data() as UserFollowingUser;
      return docData;
    });
    return followingUsers;
  }

  async addUserFollowingUser(user: UserDto, payload: UserFollowingUserPostPayload) {
    const userRef = this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(payload.userChainId + ':' + payload.userAddress);

    const followingUser = (await userRef.get()).data();
    if (!followingUser) {
      throw new InvalidUserError(payload.userAddress, payload.userChainId, 'User not found');
    }

    await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.USER_FOLLOWS_COLL)
      .doc(payload.userChainId + ':' + payload.userAddress)
      .set({
        userAddress: payload.userAddress,
        userChainId: payload.userChainId
      });
    return {};
  }

  async removeUserFollowingUser(user: UserDto, payload: UserFollowingUserDeletePayload) {
    const userRef = this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(payload.userChainId + ':' + payload.userAddress);

    const followingUser = (await userRef.get()).data();
    if (!followingUser) {
      throw new InvalidUserError(payload.userAddress, payload.userChainId, 'User not found');
    }

    await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .doc(user.userChainId + ':' + user.userAddress)
      .collection(firestoreConstants.USER_FOLLOWS_COLL)
      .doc(payload.userChainId + ':' + payload.userAddress)
      .delete();
    return {};
  }
}
