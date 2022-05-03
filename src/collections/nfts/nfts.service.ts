import { ChainId, CreationFlow } from '@infinityxyz/lib/types/core';
import { FeedEventType, NftSaleEvent } from '@infinityxyz/lib/types/core/feed';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import CollectionsService from 'collections/collections.service';
import { FirebaseService } from 'firebase/firebase.service';
import { NftActivityFiltersDto } from './dto/nft-activity-filters.dto';
import { NftActivity } from './dto/nft-activity.dto';
import { NftQueryDto } from './dto/nft-query.dto';
import { NftDto } from './dto/nft.dto';
import { NftArrayDto } from './dto/nft-array.dto';
import { NftsOrderBy, NftsQueryDto, OrderType } from './dto/nfts-query.dto';
import { ActivityType, activityTypeToEventType } from './nft-activity.types';
import { CursorService } from 'pagination/cursor.service';

@Injectable()
export class NftsService {
  constructor(
    private firebaseService: FirebaseService,
    private collectionsService: CollectionsService,
    private paginationService: CursorService
  ) {}

  async getNft(nftQuery: NftQueryDto): Promise<NftDto | undefined> {
    const collection = await this.collectionsService.getCollectionByAddress(nftQuery);

    if (collection) {
      const collectionDocId = getCollectionDocId({
        collectionAddress: collection.address,
        chainId: collection.chainId
      });

      if (collection?.state?.create?.step !== CreationFlow.Complete || !collectionDocId) {
        return undefined;
      }

      const nfts = await this.getNfts([
        { address: collection.address, chainId: collection.chainId as ChainId, tokenId: nftQuery.tokenId }
      ]);

      const nft = nfts?.[0];

      return nft;
    }
  }

  async getNfts(nfts: { address: string; chainId: ChainId; tokenId: string }[]) {
    const refs = nfts.map((item) => {
      const collectionDocId = getCollectionDocId({
        collectionAddress: item.address,
        chainId: item.chainId
      });
      return this.firebaseService.firestore
        .collection(firestoreConstants.COLLECTIONS_COLL)
        .doc(collectionDocId)
        .collection(firestoreConstants.COLLECTION_NFTS_COLL)
        .doc(item.tokenId);
    });

    if (refs.length === 0) {
      return [];
    }
    const snapshots = await this.firebaseService.firestore.getAll(...refs);

    const nftDtos = snapshots.map((snapshot, index) => {
      const nft = snapshot.data() as NftDto | undefined;

      if (nft) {
        nft.address = nfts[index].address;
      }

      return nft;
    });

    return nftDtos;
  }

  async getCollectionNfts(collection: ParsedCollectionId, query: NftsQueryDto): Promise<NftArrayDto> {
    type Cursor = Record<NftsOrderBy, string | number>;
    const nftsCollection = collection.ref.collection(firestoreConstants.COLLECTION_NFTS_COLL);
    const decodedCursor = this.paginationService.decodeCursorToObject<Cursor>(query.cursor);

    let nftsQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = nftsCollection;
    if (query.orderBy === NftsOrderBy.Price && !query.orderType) {
      query.orderType = OrderType.Listing;
    }

    const orderType = query.orderType || OrderType.Listing;
    const startPriceField = `ordersSnippet.${orderType}.orderItem.startPriceEth`;
    if (query.orderType) {
      nftsQuery = nftsQuery.where(`ordersSnippet.${orderType}.hasOrder`, '==', true);
    }

    if (query.traitTypes) {
      const traitTypes = query.traitTypes ?? [];
      const traitTypesValues = query?.traitValues?.map((item) => item.split('|')) ?? [];

      const traits: object[] = [];
      for (let index = 0; index < traitTypes.length; index++) {
        const traitType = traitTypes[index];
        const traitValues = traitTypesValues[index];
        for (const traitValue of traitValues) {
          if (traitValue) {
            const traitTypeObj = traitType ? { trait_type: traitType } : {};
            traits.push({
              value: traitValue,
              ...traitTypeObj
            });
          }
        }
      }
      if (traits.length > 0) {
        nftsQuery = nftsQuery.where('metadata.attributes', 'array-contains-any', traits);
      }
    }

    const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
    if (hasPriceFilter) {
      const minPrice = query.minPrice ?? 0;
      const maxPrice = query.maxPrice ?? Number.MAX_SAFE_INTEGER;
      nftsQuery = nftsQuery.where(startPriceField, '>=', minPrice);
      nftsQuery = nftsQuery.where(startPriceField, '<=', maxPrice);
    }

    let orderBy: string = query.orderBy;
    if (orderBy === NftsOrderBy.Price) {
      orderBy = startPriceField;
    }
    nftsQuery = nftsQuery.orderBy(orderBy, query.orderDirection);

    if (decodedCursor?.[query.orderBy]) {
      nftsQuery = nftsQuery.startAfter(decodedCursor[query.orderBy]);
    }

    nftsQuery = nftsQuery.limit(query.limit + 1); // +1 to check if there are more events

    const results = await nftsQuery.get();
    const data = results.docs.map((item) => item.data() as NftDto);

    const hasNextPage = data.length > query.limit;
    if (hasNextPage) {
      data.pop();
    }

    const cursor: Cursor = {} as any;
    const lastItem = data[data.length - 1];
    for (const key of Object.values(NftsOrderBy) as NftsOrderBy[]) {
      switch (key) {
        case NftsOrderBy.Price: {
          const startPrice = lastItem?.ordersSnippet?.[orderType]?.orderItem?.startPriceEth;
          if (startPrice) {
            cursor[NftsOrderBy.Price] = startPrice;
          }
          break;
        }
        case NftsOrderBy.RarityRank:
        case NftsOrderBy.TokenId:
          if (lastItem?.[key]) {
            cursor[key] = lastItem[key];
          }
          break;
      }
    }
    const encodedCursor = this.paginationService.encodeCursor(cursor);

    return {
      data,
      cursor: encodedCursor,
      hasNextPage
    };
  }

  async getNftActivity(nftQuery: NftQueryDto, filter: NftActivityFiltersDto) {
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
      const decodedCursor = this.paginationService.decodeCursorToNumber(filter.cursor);
      activityQuery = activityQuery.startAfter(decodedCursor);
    }

    activityQuery.limit(filter.limit + 1); // +1 to check if there are more events

    const results = await activityQuery.get();

    const data = results.docs.map((item) => item.data());

    const activities = data.map((item) => {
      let activity: NftActivity;
      switch (item.type) {
        case FeedEventType.NftSale:
          {
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
          }

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
    const cursor = this.paginationService.encodeCursor(rawCursor);

    return {
      data: activities,
      hasNextPage,
      cursor
    };
  }
}
