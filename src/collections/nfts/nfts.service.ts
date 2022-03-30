import { ChainId, CreationFlow } from '@infinityxyz/lib/types/core';
import { FeedEventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { Injectable, NotFoundException } from '@nestjs/common';
import CollectionsService from 'collections/collections.service';
import { CollectionDto } from 'collections/dto/collection.dto';
import { FirebaseService } from 'firebase/firebase.service';
import { base64Decode, base64Encode } from 'utils';
import { NftActivityFilters } from './dto/nft-activity-filters';
import { NftActivity } from './dto/nft-activity.dto';
import { NftQueryDto } from './dto/nft-query.dto';
import { NftDto } from './dto/nft.dto';
import { ActivityType, activityTypeToEventType } from './nft-activity.types';

@Injectable()
export class NftsService {
  constructor(private firebaseService: FirebaseService, private collectionsService: CollectionsService) {}

  async getNft(nftQuery: NftQueryDto): Promise<NftDto> {
    const collection: CollectionDto = await this.collectionsService.getCollectionBySlugOrAddress(nftQuery);

    const collectionDocId = getCollectionDocId({ collectionAddress: collection.address, chainId: collection.chainId });

    if (collection?.state?.create?.step !== CreationFlow.Complete || !collectionDocId) {
      throw new NotFoundException(
        `Failed to find collection with address: ${nftQuery.address} and chainId: ${nftQuery.chainId}`
      );
    }

    const nftDocRef = this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(collectionDocId)
      .collection(firestoreConstants.COLLECTION_NFTS_COLL)
      .doc(nftQuery.tokenId);

    const nftSnapshot = await nftDocRef.get();

    const nft = nftSnapshot.data() as NftDto | undefined;

    if (!nft) {
      throw new NotFoundException(`Failed to find nft with tokenId: ${nftQuery.tokenId}`);
    }

    return nft;
  }

  async getNftActivity(nftQuery: NftQueryDto, filter: NftActivityFilters) {
    const eventTypes = typeof filter.eventType === 'string' ? [filter.eventType] : filter.eventType;
    const events = eventTypes?.map((item) => activityTypeToEventType[item]).filter((item) => !!item);
    let activityQuery = this.firebaseService.firestore
      .collection(firestoreConstants.FEED_COLL)
      .where('collectionAddress', '==', nftQuery.address)
      .where('chainId', '==', nftQuery.chainId)
      .where('tokenId', '==', nftQuery.tokenId)
      .where('type', 'in', events)
      .orderBy('timestamp', 'desc');

    if (filter.cursor) {
      const decodedCursor = parseInt(base64Decode(filter.cursor), 10);
      activityQuery = activityQuery.startAfter(decodedCursor);
    }

    activityQuery.limit(filter.limit + 1); // +1 to check if there are more events

    const results = await activityQuery.get();

    const data = results.docs.map((item) => item.data());

    const activities = data.map((item) => {
      let activity: NftActivity;
      switch (item.type) {
        case FeedEventType.NftSale:
          const sale: NftSaleEvent = item as any;
          activity = {
            address: sale.collectionAddress,
            tokenId: sale.tokenId,
            chainId: sale.chainId as ChainId,
            type: ActivityType.Sale,
            from: sale.seller,
            fromDisplayName: sale.sellerDisplayName,
            to: sale.buyer,
            toDisplayName: sale.buyerDisplayName,
            price: sale.price,
            paymentToken: sale.paymentToken,
            internalUrl: sale.internalUrl,
            externalUrl: sale.externalUrl,
            timestamp: sale.timestamp
          };
          break;
        default:
          throw new Error(`Activity transformation not implemented type: ${item.type}`);
      }

      return activity;
    });

    const hasNextPage = data.length > filter.limit;

    if (hasNextPage) {
      activities.pop(); // Remove item used for pagination
    }

    const rawCursor = `${activities?.[activities?.length - 1]?.timestamp ?? ''}`;
    const cursor = base64Encode(rawCursor);

    return {
      data: activities,
      hasNextPage,
      cursor
    };
  }
}
