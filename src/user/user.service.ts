/* eslint-disable no-empty */
import { ChainId } from '@infinityxyz/lib/types/core';
import { AlchemyNftToInfinityNft } from 'alchemy/alchemy-nft-to-infinity-nft.pipe';
import { AlchemyService } from 'alchemy/alchemy.service';
import { CreationFlow, OrderDirection } from '@infinityxyz/lib/types/core';
import { NftListingEvent, NftOfferEvent, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { firestoreConstants, trimLowerCase } from '@infinityxyz/lib/utils';
import { Injectable, Optional } from '@nestjs/common';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { NftArrayDto } from 'collections/nfts/dto/nft-array.dto';
import { NftDto } from 'collections/nfts/dto/nft.dto';
import { ActivityType, activityTypeToEventType } from 'collections/nfts/nft-activity.types';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { InvalidUserError } from 'common/errors/invalid-user.error';
import { BigNumber } from 'ethers/lib/ethers';
import { FirebaseService } from 'firebase/firebase.service';
import { CursorService } from 'pagination/cursor.service';
import { StatsService } from 'stats/stats.service';
import { UserFollowingCollection } from 'user/dto/user-following-collection.dto';
import { UserActivityArrayDto } from './dto/user-activity-array.dto';
import { UserActivityQueryDto } from './dto/user-activity-query.dto';
import { UserFollowingCollectionDeletePayload } from './dto/user-following-collection-delete-payload.dto';
import { UserFollowingCollectionPostPayload } from './dto/user-following-collection-post-payload.dto';
import { UserFollowingUserDeletePayload } from './dto/user-following-user-delete-payload.dto';
import { UserFollowingUserPostPayload } from './dto/user-following-user-post-payload.dto';
import { UserFollowingUser } from './dto/user-following-user.dto';
import { UserNftsOrderType, UserNftsQueryDto } from './dto/user-nfts-query.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ParsedUserId } from './parser/parsed-user-id';
import { MnemonicService } from 'mnemonic/mnemonic.service';
import { BadQueryError } from 'common/errors/bad-query.error';

export type UserActivity = NftSaleEvent | NftListingEvent | NftOfferEvent;

@Injectable()
export class UserService {
  constructor(
    private firebaseService: FirebaseService,
    private alchemyService: AlchemyService,
    private alchemyNftToInfinityNft: AlchemyNftToInfinityNft,
    private mnemonicSErvice: MnemonicService,
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

  async getUserNftsWithOrders(user: ParsedUserId, nftsQuery: UserNftsQueryDto): Promise<NftArrayDto> {
    let query: FirebaseFirestore.Query<NftDto> = this.firebaseService.firestore.collectionGroup(
      firestoreConstants.COLLECTION_NFTS_COLL
    ) as any as FirebaseFirestore.Query<NftDto>;
    let orderSnippetItem = '';

    switch (nftsQuery.orderType) {
      case UserNftsOrderType.Listings:
        orderSnippetItem = 'ordersSnippet.listing.orderItem';
        query = query.where(`${orderSnippetItem}.makerAddress`, '==', user.userAddress);
        break;
      case UserNftsOrderType.OffersMade:
        orderSnippetItem = 'ordersSnippet.offer.orderItem';
        query = query.where(`${orderSnippetItem}.makerAddress`, '==', user.userAddress);
        break;
      case UserNftsOrderType.OffersReceived:
        orderSnippetItem = 'ordersSnippet.offer.orderItem';
        query = query.where(`${orderSnippetItem}.takerAddress`, '==', user.userAddress);
        break;
      default:
        throw new BadQueryError('orderType is invalid');
    }

    if (nftsQuery.collectionAddresses && nftsQuery.collectionAddresses.length > 0) {
      query = query.where(`${orderSnippetItem}.collectionAddress`, 'in', nftsQuery.collectionAddresses);
    }

    const minPrice = nftsQuery.minPrice ?? 0;
    const maxPrice = nftsQuery.maxPrice ?? Number.MAX_SAFE_INTEGER;
    query = query.where(`${orderSnippetItem}.startPriceEth`, '>=', minPrice);
    query = query.where(`${orderSnippetItem}.startPriceEth`, '<=', maxPrice);

    const orderDirection = nftsQuery.orderDirection ?? OrderDirection.Descending;
    query = query.orderBy(`${orderSnippetItem}.startPriceEth`, orderDirection);

    type Cursor = { startPriceEth?: number };
    const cursor = this.paginationService.decodeCursorToObject<Cursor>(nftsQuery.cursor);
    if (cursor.startPriceEth != null) {
      query = query.startAfter(cursor.startPriceEth);
    }

    const nftsSnapshot = await query.limit(nftsQuery.limit + 1).get();

    const nfts: NftDto[] = nftsSnapshot.docs.map((doc) => {
      const docData = doc.data();
      return docData;
    });

    let hasNextPage = false;
    if (nfts.length > nftsQuery.limit) {
      hasNextPage = true;
      nfts.pop();
    }

    const lastItem = nfts[nfts.length - 1];
    const orderField = nftsQuery.orderType === UserNftsOrderType.Listings ? 'listing' : 'offer';
    const price = lastItem?.ordersSnippet?.[orderField]?.orderItem?.startPriceEth;
    const cursorObj: Cursor = { startPriceEth: price };
    const updatedCursor = this.paginationService.encodeCursor(cursorObj);

    return {
      cursor: updatedCursor,
      hasNextPage,
      data: nfts
    };
  }

  async getNfts(
    user: ParsedUserId,
    query: Pick<UserNftsQueryDto, 'collectionAddresses' | 'cursor' | 'limit'>
  ): Promise<NftArrayDto> {
    const chainId = ChainId.Mainnet;
    type Cursor = { pageKey?: string; startAtToken?: string };
    const cursor = this.paginationService.decodeCursorToObject<Cursor>(query.cursor);
    const getPage = async (
      pageKey: string,
      startAtToken?: string
    ): Promise<{ pageKey: string; nfts: NftDto[]; hasNextPage: boolean }> => {
      const response = await this.alchemyService.getUserNfts(
        user.userAddress,
        ChainId.Mainnet,
        pageKey,
        query.collectionAddresses
      );
      const nextPageKey = response?.pageKey ?? '';
      let nfts = response?.ownedNfts ?? [];

      if (startAtToken) {
        const indexToStartAt = nfts.findIndex(
          (item) => BigNumber.from(item.id.tokenId).toString() === cursor.startAtToken
        );
        nfts = nfts.slice(indexToStartAt);
      }

      const nftsToTransform = nfts.map((item) => ({ alchemyNft: item, chainId }));
      const results = await this.alchemyNftToInfinityNft.transform(nftsToTransform);
      const validNfts = results.filter((item) => !!item) as NftDto[];

      return { pageKey: nextPageKey, nfts: validNfts, hasNextPage: !!nextPageKey };
    };

    const limit = query.limit + 1; // +1 to check if there is a next page
    let nfts: NftDto[] = [];
    let alchemyHasNextPage = true;
    let pageKey = '';
    let nextPageKey = cursor?.pageKey ?? '';
    let pageNumber = 0;
    while (nfts.length < limit && alchemyHasNextPage) {
      pageKey = nextPageKey;
      const startAtToken = pageNumber === 0 && cursor.startAtToken ? cursor.startAtToken : undefined;
      const response = await getPage(pageKey, startAtToken);
      nfts = [...nfts, ...response.nfts];
      alchemyHasNextPage = response.hasNextPage;
      nextPageKey = response.pageKey;
      pageNumber += 1;
    }

    const continueFromCurrentPage = nfts.length > query.limit;
    const hasNextPage = continueFromCurrentPage || alchemyHasNextPage;
    const nftsToReturn = nfts.slice(0, query.limit);
    const nftToStartAt = nfts?.[query.limit]?.tokenId;

    const updatedCursor = this.paginationService.encodeCursor({
      pageKey: continueFromCurrentPage ? pageKey : nextPageKey,
      startAtToken: nftToStartAt
    });

    return {
      data: nftsToReturn,
      cursor: updatedCursor,
      hasNextPage
    };
  }

  async getByUsername(username: string) {
    const snapshot = await this.firebaseService.firestore
      .collection(firestoreConstants.USERS_COLL)
      .where('username', '==', trimLowerCase(username))
      .limit(1)
      .get();

    const doc = snapshot.docs[0];

    if (!doc?.exists) {
      return { user: null, ref: null };
    }

    const user = doc?.data() as UserProfileDto;

    return { user, ref: doc.ref as FirebaseFirestore.DocumentReference<UserProfileDto> };
  }

  /**
   * Returns a document reference to the collection with the specified address.
   */
  getRef(address: string) {
    return this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL).doc(address);
  }

  async getActivity(user: ParsedUserId, query: UserActivityQueryDto): Promise<UserActivityArrayDto> {
    const activityTypes = query.events && query?.events.length > 0 ? query.events : Object.values(ActivityType);

    const events = activityTypes.map((item) => activityTypeToEventType[item]);

    let userEventsQuery = this.firebaseService.firestore
      .collection(firestoreConstants.FEED_COLL)
      .where('type', 'in', events)
      .where('usersInvolved', 'array-contains', user.userAddress);

    const cursor = this.paginationService.decodeCursorToNumber(query.cursor);
    const orderDirection = OrderDirection.Descending;

    userEventsQuery = userEventsQuery.orderBy('timestamp', orderDirection).limit(query.limit + 1);

    if (!Number.isNaN(cursor)) {
      userEventsQuery = userEventsQuery.startAfter(cursor);
    }
    const snapshot = await userEventsQuery.get();

    const data = snapshot.docs.map((item) => item.data() as UserActivity);

    const hasNextPage = data.length > query.limit;
    if (hasNextPage) {
      data.pop();
    }
    const lastItem = data?.[data?.length - 1];
    const nextCursor = this.paginationService.encodeCursor(lastItem?.timestamp ?? '');

    return {
      data: data,
      hasNextPage,
      cursor: nextCursor
    };
  }
}
