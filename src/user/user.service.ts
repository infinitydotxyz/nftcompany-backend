/* eslint-disable no-empty */
import { ChainId, CreationFlow, OrderDirection } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { AlchemyNftToInfinityNft } from 'alchemy/alchemy-nft-to-infinity-nft.pipe';
import { AlchemyService } from 'alchemy/alchemy.service';
import { Optional } from '@nestjs/common';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { NftArrayDto } from 'collections/nfts/dto/nft-array.dto';
import { NftDto } from 'collections/nfts/dto/nft.dto';
import { InvalidCollectionError } from 'common/errors/invalid-collection.error';
import { InvalidUserError } from 'common/errors/invalid-user.error';
import { BigNumber } from 'ethers/lib/ethers';
import { FirebaseService } from 'firebase/firebase.service';
import { StatsService } from 'stats/stats.service';
import { UserFollowingCollection } from 'user/dto/user-following-collection.dto';
import { base64Decode, base64Encode } from 'utils';
import { UserFollowingCollectionDeletePayload } from './dto/user-following-collection-delete-payload.dto';
import { UserFollowingCollectionPostPayload } from './dto/user-following-collection-post-payload.dto';
import { UserFollowingUserDeletePayload } from './dto/user-following-user-delete-payload.dto';
import { UserFollowingUserPostPayload } from './dto/user-following-user-post-payload.dto';
import { UserFollowingUser } from './dto/user-following-user.dto';
import { UserNftsQueryDto } from './dto/user-nfts-query.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ParsedUserId } from './parser/parsed-user-id';

@Injectable()
export class UserService {
  constructor(
    private firebaseService: FirebaseService,
    private alchemyService: AlchemyService,
    private alchemyNftToInfinityNft: AlchemyNftToInfinityNft,
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

  async getNfts(user: ParsedUserId, query: UserNftsQueryDto): Promise<NftArrayDto> {
    const chainId = ChainId.Mainnet;
    let cursor: { pageKey?: string; startAtToken?: string } = {};
    try {
      cursor = JSON.parse(base64Decode(query.cursor ?? ''));
    } catch {}

    const getPage = async (
      pageKey: string,
      startAtToken?: string
    ): Promise<{ pageKey: string; nfts: NftDto[]; hasNextPage: boolean }> => {
      const response = await this.alchemyService.getUserNfts(user.userAddress, ChainId.Mainnet, pageKey);
      const nextPageKey = response?.pageKey ?? '';
      let nfts = response?.ownedNfts ?? [];

      if (startAtToken) {
        const indexToStartAt = nfts.findIndex(
          (item) => BigNumber.from(item.id.tokenId).toString() === cursor.startAtToken
        );
        nfts = nfts.slice(indexToStartAt);
      }

      const promises = nfts?.map((alchemyNft) => {
        return this.alchemyNftToInfinityNft.transform({ alchemyNft, chainId });
      });
      const results = await Promise.all(promises);
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

    const updatedCursor = base64Encode(
      JSON.stringify({
        pageKey: continueFromCurrentPage ? pageKey : nextPageKey,
        startAtToken: nftToStartAt
      })
    );

    return {
      data: nftsToReturn,
      cursor: updatedCursor,
      hasNextPage
    };
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
}
