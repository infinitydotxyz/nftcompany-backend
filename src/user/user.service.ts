import { ChainId, CreationFlow, OrderDirection } from '@infinityxyz/lib/types/core';
import { ExchangeEvent, FeedEventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable, Optional } from '@nestjs/common';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { NftActivity } from 'collections/nfts/dto/nft-activity.dto';
import { ActivityType, activityTypeToEventType } from 'collections/nfts/nft-activity.types';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { InvalidUserError } from 'common/errors/invalid-user.error';
import { FirebaseService } from 'firebase/firebase.service';
import { CursorService } from 'pagination/cursor.service';
import { StatsService } from 'stats/stats.service';
import { UserFollowingCollection } from 'user/dto/user-following-collection.dto';
import { UserActivityQueryDto } from './dto/user-activity-query.dto';
import { UserFollowingCollectionDeletePayload } from './dto/user-following-collection-delete-payload.dto';
import { UserFollowingCollectionPostPayload } from './dto/user-following-collection-post-payload.dto';
import { UserFollowingUserDeletePayload } from './dto/user-following-user-delete-payload.dto';
import { UserFollowingUserPostPayload } from './dto/user-following-user-post-payload.dto';
import { UserFollowingUser } from './dto/user-following-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ParsedUserId } from './parser/parsed-user-id';

@Injectable()
export class UserService {
  constructor(
    private firebaseService: FirebaseService,
    private paginationService: CursorService,
    @Optional() private statsService: StatsService
  ) {}

  async getWatchlist(user: ParsedUserId, query: RankingsRequestDto) {
    const collectionFollows = user.ref
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL)
      .select('collectionAddress', 'collectionChainId');
    const snap = await collectionFollows.get();
    const collections = snap.docs
      .map((doc) => {
        const { collectionAddress, collectionChainId } = doc.data();
        return { chainId: collectionChainId, address: collectionAddress };
      })
      .filter((item) => {
        return item.chainId && item.address;
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

  async getProfile(user: ParsedUserId) {
    const profileSnapshot = await user.ref.get();
    const profile = profileSnapshot.data();

    if (!profile) {
      return null;
    }

    return profile;
  }

  async getCollectionsBeingFollowed(user: ParsedUserId) {
    const collectionFollows = user.ref.collection(firestoreConstants.COLLECTION_FOLLOWS_COLL);

    const snap = await collectionFollows.get();
    const followingCollections: UserFollowingCollection[] = snap.docs.map((doc) => {
      const docData = doc.data() as UserFollowingCollection;
      return docData;
    });
    return followingCollections;
  }

  async followCollection(user: ParsedUserId, payload: UserFollowingCollectionPostPayload) {
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

    await user.ref
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

  async unfollowCollection(user: ParsedUserId, payload: UserFollowingCollectionDeletePayload) {
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

    await user.ref
      .collection(firestoreConstants.COLLECTION_FOLLOWS_COLL)
      .doc(payload.collectionChainId + ':' + payload.collectionAddress)
      .delete();
    return {};
  }

  async getUsersBeingFollowed(user: ParsedUserId) {
    const userFollows = user.ref.collection(firestoreConstants.USER_FOLLOWS_COLL);

    const snap = await userFollows.get();
    const followingUsers: UserFollowingUser[] = snap.docs.map((doc) => {
      const docData = doc.data() as UserFollowingUser;
      return docData;
    });
    return followingUsers;
  }

  async followUser(user: ParsedUserId, payload: UserFollowingUserPostPayload) {
    const userRef = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL).doc(payload.userAddress);

    const followingUser = (await userRef.get()).data();
    if (!followingUser) {
      throw new InvalidUserError(payload.userAddress, 'User not found');
    }

    await user.ref.collection(firestoreConstants.USER_FOLLOWS_COLL).doc(payload.userAddress).set({
      userAddress: payload.userAddress
    });
    return {};
  }

  async unfollowUser(user: ParsedUserId, payload: UserFollowingUserDeletePayload) {
    const followingUser = (await user.ref.get()).data();
    if (!followingUser) {
      throw new InvalidUserError(payload.userAddress, 'User not found');
    }

    await user.ref.collection(firestoreConstants.USER_FOLLOWS_COLL).doc(payload.userAddress).delete();
    return {};
  }

  async getByUsername(username: string) {
    const snapshot = await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .where('username', '==', username)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];

    const user = doc?.data() as UserProfileDto;

    return { user, ref: doc.ref as FirebaseFirestore.DocumentReference<UserProfileDto> };
  }

  /**
   * Returns a document reference to the collection with the specified address.
   */
  getRef(address: string) {
    return this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL).doc(address);
  }

  private transformSale(sale: NftSaleEvent): NftActivity {
    const activity: NftActivity = {
      address: sale.collectionAddress,
      tokenId: sale.tokenId,
      chainId: sale.chainId as ChainId,
      type: ActivityType.Sale,
      from: sale.seller,
      to: sale.buyer,
      price: sale.price,
      timestamp: sale.timestamp,
      paymentToken: sale.paymentToken
    };
    return activity;
  }

  async getActivity(user: ParsedUserId, query: UserActivityQueryDto) {
    const activityTypes = query.events.length > 0 ? query.events : Object.values(ActivityType);

    const events = activityTypes.map((item) => activityTypeToEventType[item]);

    const queries = events.map((event) => {
      const firestoreQuery = this.firebaseService.firestore
        .collection(firestoreConstants.FEED_COLL)
        .where('type', '==', event);
      switch (event) {
        case FeedEventType.NftSale: {
          const sales = firestoreQuery.where('seller', '==', user.userAddress);
          const purchases = firestoreQuery.where('buyer', '==', user.userAddress);
          return [sales, purchases];
        }
        // case FeedEventType.NftListing: {
        //   const listings = firestoreQuery.where('maker', '==', user.userAddress); // TODO is maker correct?
        //   return [listings];
        // }
        // case FeedEventType.NftOffer: {
        //   const offersMade = firestoreQuery.where('maker', '==', user.userAddress);
        //   const offersReceived = firestoreQuery.where('taker', '==', user.userAddress); // TODO is taker correct?
        //   return [offersMade, offersReceived];
        // }
        default:
          console.log(`Unsupported activity type. ${event}`);
          return [];
      }
    });

    const cursor = this.paginationService.decodeCursorToNumber(query.cursor);
    const orderDirection = OrderDirection.Descending;

    const snapshots = await Promise.all(
      queries
        .flatMap((item) => item)
        .map((firestoreQuery) => {
          let q = firestoreQuery.orderBy('timestamp', orderDirection).limit(query.limit + 1);
          if (!Number.isNaN(cursor)) {
            q = q.startAfter(cursor);
          }
          return q.get();
        })
    );

    const docs = snapshots.flatMap((item) => item.docs);

    const data = docs
      .map((item) => item.data())
      .filter((item) => !!item)
      .sort((a, b) =>
        orderDirection === OrderDirection.Descending ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
      ) as (NftSaleEvent | ExchangeEvent)[]; // TODO update to include order/listing event types

    const results = data.slice(0, query.limit + 1);
    const hasNextPage = results.length > query.limit;
    if (hasNextPage) {
      results.pop();
    }
    const lastItem = results?.[results?.length - 1];
    const nextCursor = this.paginationService.encodeCursor(lastItem?.timestamp ?? '');

    const activityEvents = results
      .map((item) => {
        switch (item.type) {
          case FeedEventType.NftSale:
            return this.transformSale(item as NftSaleEvent);
          default:
            console.log(`Unsupported activity type. ${item.type}`);
            return null;
        }
      })
      .filter((item) => !!item) as NftActivity[];

    return {
      data: activityEvents,
      hasNextPage,
      cursor: nextCursor
    };
  }
}
