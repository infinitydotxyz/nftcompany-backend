import {
  ChainId,
  Collection,
  CreationFlow,
  FirestoreOrder,
  FirestoreOrderItem,
  InfinityLinkType,
  OBOrderItem,
  OBOrderStatus,
  OBTokenInfo,
  RefreshTokenFlow,
  SignedOBOrder,
  Token
} from '@infinityxyz/lib/types/core';
import {
  firestoreConstants,
  getCreatorFeeManagerAddress,
  getFeeTreasuryAddress,
  getInfinityLink,
  trimLowerCase
} from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import FirestoreBatchHandler from '../databases/FirestoreBatchHandler';
import { BigNumber, ethers } from 'ethers';
import { getProvider } from '../utils/ethers';
import { FirebaseService } from '../firebase/firebase.service';
import { getERC721Owner } from '../services/ethereum/checkOwnershipChange';
import { getDocIdHash } from '../utils';
import { SignedOBOrderDto } from './dto/signed-ob-order.dto';
import { InfinityFeeTreasuryABI } from '../abi/infinityFeeTreasury';
import { InfinityCreatorsFeeManagerABI } from '../abi/infinityCreatorsFeeManager';
import { getOrderIdFromSignedOrder } from './orders.utils';
import { ChainNFTsDto } from './dto/chain-nfts.dto';
import { ParsedUserId } from '../user/parser/parsed-user-id';
import { UserService } from '../user/user.service';
import CollectionsService from '../collections/collections.service';
import { NftsService } from '../collections/nfts/nfts.service';
import { OrderItemTokenMetadata, OrderMetadata } from './order.types';
import { InvalidCollectionError } from '../common/errors/invalid-collection.error';
import { UserParserService } from '../user/parser/parser.service';
import { FeedEventType, NftListingEvent, NftOfferEvent } from '@infinityxyz/lib/types/core/feed';

// todo: remove this with the below commented code
// export interface ExpiredCacheItem {
//   listId: MarketListId;
//   order: OBOrder;
// }

// interface SellOrderSave extends OBOrder {
//   collectionAddresses: string[];
// }

@Injectable()
export default class OrdersService {
  constructor(
    private firebaseService: FirebaseService,
    private userService: UserService,
    private collectionService: CollectionsService,
    private nftsService: NftsService,
    private userParser: UserParserService
  ) {}

  public async createOrder(maker: ParsedUserId, orders: SignedOBOrderDto[]): Promise<string> {
    try {
      const fsBatchHandler = new FirestoreBatchHandler();
      const ordersCollectionRef = this.firebaseService.firestore.collection(firestoreConstants.ORDERS_COLL);
      const metadata = await this.getOrderMetadata(orders);
      const makerProfile = await this.userService.getProfile(maker);
      const makerUsername = makerProfile?.username ?? '';

      for (const order of orders) {
        // get data
        const orderId = getOrderIdFromSignedOrder(order, maker.userAddress);
        const dataToStore = this.getFirestoreOrderFromSignedOBOrder(maker.userAddress, makerUsername, order, orderId);
        // save
        const docRef = ordersCollectionRef.doc(orderId);
        fsBatchHandler.add(docRef, dataToStore, { merge: true });

        // get order items
        const orderItemsRef = docRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL);
        try {
          for (const nft of order.signedOrder.nfts) {
            if (nft.tokens.length === 0) {
              // to support any tokens from a collection type orders
              const emptyToken: OrderItemTokenMetadata = {
                tokenId: '',
                numTokens: 1, // default for both ERC721 and ERC1155
                tokenImage: '',
                tokenName: '',
                tokenSlug: ''
              };
              const collection: Collection = {} as Collection;
              const orderItemData = await this.getFirestoreOrderItemFromSignedOBOrder(
                order,
                nft,
                emptyToken,
                orderId,
                maker.userAddress,
                makerUsername,
                collection
              );
              // get doc id
              const tokenId = '';
              const orderItemDocRef = orderItemsRef.doc(
                getDocIdHash({ collectionAddress: nft.collection, tokenId, chainId: order.chainId })
              );
              // add to batch
              fsBatchHandler.add(orderItemDocRef, orderItemData, { merge: true });
              this.writeOrderItemsToFeed([{ ...orderItemData, orderItemId: orderItemDocRef.id }], fsBatchHandler);
            } else {
              for (const token of nft.tokens) {
                const orderItemMetadata = metadata[order.chainId as ChainId][nft.collection];
                const tokenData = orderItemMetadata.nfts[token.tokenId];
                const collection = orderItemMetadata.collection;
                const orderItemTokenMetadata: OrderItemTokenMetadata = {
                  tokenId: token.tokenId,
                  numTokens: token.numTokens, // default for both ERC721 and ERC1155
                  tokenImage: tokenData.image.url,
                  tokenName: (tokenData.metadata).name ?? '',
                  tokenSlug: tokenData.slug
                };

                const orderItemData = await this.getFirestoreOrderItemFromSignedOBOrder(
                  order,
                  nft,
                  orderItemTokenMetadata,
                  orderId,
                  maker.userAddress,
                  makerUsername,
                  collection
                );
                // get doc id
                const tokenId = token.tokenId.toString();
                const orderItemDocRef = orderItemsRef.doc(
                  getDocIdHash({ collectionAddress: nft.collection, tokenId, chainId: order.chainId })
                );
                // add to batch
                fsBatchHandler.add(orderItemDocRef, orderItemData, { merge: true });
                this.writeOrderItemsToFeed([{ ...orderItemData, orderItemId: orderItemDocRef.id }], fsBatchHandler);
              }
            }
          }
        } catch (err: any) {
          console.error('Failed saving orders to firestore', err);
          return 'Failed';
        }
      }
      // commit batch
      await fsBatchHandler.flush();
    } catch (err) {
      console.error('Failed to post orders', err);
      return 'Failed';
    }
    return 'Success';
  }

  private async getOrderMetadata(orders: SignedOBOrderDto[]): Promise<OrderMetadata> {
    type CollectionAddress = string;
    type TokenId = string;
    const tokens: Map<ChainId, Map<CollectionAddress, Set<TokenId>>> = new Map();

    for (const order of orders) {
      const collectionsByChainId = tokens.get(order.chainId as ChainId) ?? new Map<CollectionAddress, Set<TokenId>>();
      for (const nft of order.signedOrder.nfts) {
        const tokensByCollection = collectionsByChainId.get(nft.collection) ?? new Set();
        for (const token of nft.tokens) {
          tokensByCollection.add(token.tokenId);
        }
        collectionsByChainId.set(nft.collection, tokensByCollection);
      }
      tokens.set(order.chainId as ChainId, collectionsByChainId);
    }

    const metadata: OrderMetadata = {};
    for (const [chainId, collections] of tokens) {
      const collectionsData = await Promise.all(
        [...collections].map(([address]) => {
          return this.collectionService.getCollectionByAddress({
            address,
            chainId
          });
        })
      );
      const collectionsByAddress = collectionsData.reduce((acc: { [address: string]: Collection }, collection) => {
        if (collection?.state?.create?.step !== CreationFlow.Complete) {
          throw new InvalidCollectionError(
            collection?.address ?? 'Unknown',
            collection?.chainId ?? 'Unknown',
            'Collection indexing is not complete'
          );
        }
        return {
          ...acc,
          [collection.address]: collection
        };
      }, {});

      for (const [collectionAddress, tokenIds] of collections) {
        const tokens = await Promise.all(
          [...tokenIds].map((tokenId) => {
            return this.nftsService.getNft({
              address: collectionAddress,
              chainId,
              tokenId
            });
          })
        );

        for (const token of tokens) {
          if (token?.state?.metadata?.step !== RefreshTokenFlow.Complete) {
            throw new InvalidCollectionError(collectionAddress, chainId, 'Token was not found');
          }
          metadata[chainId] = {
            [collectionAddress]: {
              collection: collectionsByAddress[collectionAddress],
              nfts: {
                [token.tokenId]: token as Token
              }
            }
          };
        }
      }
    }
    return metadata;
  }

  // todo: change this when fees change
  public async fetchMinBps(chainId: string, collections: string[]): Promise<number> {
    let minBps = 10000;
    try {
      const curatorFeeBps = await this.getCuratorFeeBps(chainId);
      console.log(`Curator fee bps: ${curatorFeeBps}`);
      for (const collection of collections) {
        const creatorFeeBps = await this.getCreatorFeeBps(chainId, collection);
        console.log(`Creator fee bps for ${collection}: ${creatorFeeBps}`);
        const totalBps = curatorFeeBps + creatorFeeBps;
        minBps = Math.min(minBps, totalBps);
      }
    } catch (e) {
      console.error('Failed to fetch min bps', e);
    }
    return minBps;
  }

  public async getOrders(
    firestoreQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
  ): Promise<SignedOBOrder[]> {
    // fetch query snapshot
    const firestoreOrderItems = await firestoreQuery.get();
    const obOrderItemMap: { [key: string]: { [key: string]: OBOrderItem } } = {};
    const results: SignedOBOrder[] = [];
    for (const orderItemDoc of firestoreOrderItems.docs) {
      const orderItemData = orderItemDoc.data() as FirestoreOrderItem;
      const orderDoc = orderItemDoc.ref.parent.parent;
      const orderDocData = (await orderDoc?.get())?.data() as FirestoreOrder;
      if (!orderDocData) {
        console.error('Cannot fetch order data from firestore for order item', orderItemData.id);
        continue;
      }
      const token: OBTokenInfo = {
        tokenId: orderItemData.tokenId,
        numTokens: orderItemData.numTokens,
        tokenImage: orderItemData.tokenImage,
        tokenName: orderItemData.tokenName,
        takerAddress: orderItemData.takerAddress,
        takerUsername: orderItemData.takerUsername
      };
      const existingOrder = obOrderItemMap[orderItemData.id];
      if (existingOrder) {
        const existingOrderItem = existingOrder[orderItemData.collectionAddress];
        if (existingOrderItem) {
          existingOrderItem.tokens.push(token);
        } else {
          existingOrder[orderItemData.collectionAddress] = {
            collectionAddress: orderItemData.collectionAddress,
            collectionName: orderItemData.collectionName,
            collectionImage: orderItemData.collectionImage,
            tokens: [token]
          };
        }
      } else {
        const obOrderItem: OBOrderItem = {
          collectionAddress: orderItemData.collectionAddress,
          collectionImage: orderItemData.collectionImage,
          collectionName: orderItemData.collectionName,
          tokens: [token]
        };
        obOrderItemMap[orderItemData.id] = { [orderItemData.collectionAddress]: obOrderItem };
      }
      const signedOBOrder: SignedOBOrder = {
        id: orderItemData.id,
        chainId: orderItemData.chainId,
        isSellOrder: orderItemData.isSellOrder,
        numItems: orderItemData.numItems,
        startPriceEth: orderItemData.startPriceEth,
        endPriceEth: orderItemData.endPriceEth,
        startTimeMs: orderItemData.startTimeMs,
        endTimeMs: orderItemData.endTimeMs,
        minBpsToSeller: orderDocData.minBpsToSeller,
        nonce: orderDocData.nonce,
        makerAddress: orderItemData.makerAddress,
        makerUsername: orderItemData.makerUsername,
        nfts: Object.values(obOrderItemMap[orderItemData.id]),
        signedOrder: orderDocData.signedOrder,
        execParams: {
          complicationAddress: orderDocData.complicationAddress,
          currencyAddress: orderDocData.currencyAddress
        },
        extraParams: {}
      };
      results.push(signedOBOrder);
    }
    return results;
  }

  public async getOrderNonce(userId: string): Promise<string> {
    try {
      const user = trimLowerCase(userId);
      const userDocRef = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL).doc(user);
      const updatedNonce = await this.firebaseService.firestore.runTransaction(async (t) => {
        const userDoc = await t.get(userDocRef);
        const userDocData = userDoc.data() || { address: user };
        const nonce = userDocData.orderNonce ?? '0';
        const newNonce = BigNumber.from(nonce).add(1).toString();
        userDocData.orderNonce = newNonce;
        t.set(userDocRef, userDocData, { merge: true });
        return newNonce;
      });
      return updatedNonce;
    } catch (e) {
      console.error('Failed to get order nonce for user', userId);
      throw e;
    }
  }

  private getFirestoreOrderFromSignedOBOrder(
    makerAddress: string,
    makerUsername: string,
    order: SignedOBOrderDto,
    orderId: string
  ): FirestoreOrder {
    try {
      const data: FirestoreOrder = {
        id: orderId,
        orderStatus: OBOrderStatus.ValidActive,
        chainId: order.chainId,
        isSellOrder: order.signedOrder.isSellOrder,
        numItems: order.numItems,
        startPriceEth: order.startPriceEth,
        endPriceEth: order.endPriceEth,
        startTimeMs: order.startTimeMs,
        endTimeMs: order.endTimeMs,
        minBpsToSeller: order.minBpsToSeller,
        nonce: order.nonce,
        complicationAddress: order.execParams.complicationAddress,
        currencyAddress: order.execParams.currencyAddress,
        makerAddress: trimLowerCase(makerAddress),
        makerUsername: trimLowerCase(makerUsername),
        signedOrder: order.signedOrder
      };
      return data;
    } catch (err) {
      console.error('Failed to get firestore order from signed order', err);
      throw err;
    }
  }

  private async getFirestoreOrderItemFromSignedOBOrder(
    order: SignedOBOrderDto,
    nft: ChainNFTsDto,
    token: OrderItemTokenMetadata,
    orderId: string,
    makerAddress: string,
    makerUsername: string,
    collection: Partial<Collection>
  ): Promise<FirestoreOrderItem> {
    let takerAddress = '';
    let takerUsername = '';
    if (!order.signedOrder.isSellOrder && nft.collection && token.tokenId) {
      // for buy orders, fetch the current owner of the token
      takerAddress = await getERC721Owner(nft.collection, token.tokenId, order.chainId);
      console.log('takerAddress', takerAddress); // todo: remove
      if (takerAddress) {
        const taker = await this.userParser.parse(takerAddress);
        const takerProfile = await this.userService.getProfile(taker);
        takerUsername = takerProfile?.username ?? '';
      }
    }
    const data: FirestoreOrderItem = {
      id: orderId,
      orderStatus: OBOrderStatus.ValidActive,
      chainId: order.chainId,
      isSellOrder: order.signedOrder.isSellOrder,
      numItems: order.numItems,
      startPriceEth: order.startPriceEth,
      endPriceEth: order.endPriceEth,
      currencyAddress: order.execParams.currencyAddress,
      startTimeMs: order.startTimeMs,
      endTimeMs: order.endTimeMs,
      makerAddress: trimLowerCase(makerAddress),
      makerUsername: trimLowerCase(makerUsername),
      takerAddress: trimLowerCase(takerAddress),
      takerUsername: trimLowerCase(takerUsername),
      collectionAddress: nft.collection,
      collectionName: collection.metadata?.name ?? '',
      collectionImage: collection.metadata?.profileImage ?? '',
      collectionSlug: collection?.slug ?? '',
      hasBlueCheck: collection.hasBlueCheck ?? false,
      tokenId: token.tokenId,
      numTokens: token.numTokens,
      tokenImage: token.tokenImage,
      tokenName: token.tokenName,
      tokenSlug: token.tokenSlug
    };
    return data;
  }

  private async getCuratorFeeBps(chainId: string): Promise<number> {
    try {
      const provider = getProvider(chainId);
      if (provider == null) {
        throw new Error('Cannot get curator fee bps as provider is null');
      }
      const feeTreasuryAddress = getFeeTreasuryAddress(chainId);
      const contract = new ethers.Contract(feeTreasuryAddress, InfinityFeeTreasuryABI, provider);
      const curatorFeeBps = await contract.CURATOR_FEE_BPS();
      return curatorFeeBps;
    } catch (err) {
      console.error('Failed to get curator fee bps', err);
      throw err;
    }
  }

  private async getCreatorFeeBps(chainId: string, collection: string): Promise<number> {
    try {
      const provider = getProvider(chainId);
      if (provider == null) {
        throw new Error('Cannot get creator fee bps as provider is null');
      }
      const creatorFeeManagerAddress = getCreatorFeeManagerAddress(chainId);
      const contract = new ethers.Contract(creatorFeeManagerAddress, InfinityCreatorsFeeManagerABI, provider);
      const creatorFeeBps = await contract.getCreatorsFeeInfo(collection, 0, 0);
      return creatorFeeBps;
    } catch (err) {
      console.error('Failed to get creator fee bps', err);
      throw err;
    }
  }

  private writeOrderItemsToFeed(
    orderItems: (FirestoreOrderItem & { orderItemId: string })[],
    batch: FirebaseFirestore.WriteBatch | FirestoreBatchHandler
  ) {
    const feedCollection = this.firebaseService.firestore.collection(firestoreConstants.FEED_COLL);
    for (const orderItem of orderItems) {
      const usersInvolved = [orderItem.makerAddress, orderItem.takerAddress].filter((address) => !!address);
      const feedEvent: Omit<NftListingEvent, 'isSellOrder' | 'type'> = {
        orderId: orderItem.id,
        orderItemId: orderItem.orderItemId,
        paymentToken: orderItem.currencyAddress,
        quantity: orderItem.numTokens,
        startPriceEth: orderItem.startPriceEth,
        endPriceEth: orderItem.endPriceEth,
        startTimeMs: orderItem.startTimeMs,
        endTimeMs: orderItem.endTimeMs,
        makerUsername: orderItem.makerUsername,
        makerAddress: orderItem.makerAddress,
        takerUsername: orderItem.takerUsername,
        takerAddress: orderItem.takerAddress,
        usersInvolved,
        tokenId: orderItem.tokenId,
        chainId: orderItem.chainId,
        likes: 0,
        comments: 0,
        timestamp: Date.now(),
        collectionAddress: orderItem.collectionAddress,
        collectionName: orderItem.collectionName,
        collectionSlug: orderItem.collectionSlug,
        collectionProfileImage: orderItem.collectionImage,
        hasBlueCheck: orderItem.hasBlueCheck,
        internalUrl: getInfinityLink({
          type: InfinityLinkType.Asset,
          collectionAddress: orderItem.collectionAddress,
          tokenId: orderItem.tokenId
        }),
        image: orderItem.tokenImage,
        nftName: orderItem.tokenName,
        nftSlug: orderItem.tokenSlug
      };
      let event: NftListingEvent | NftOfferEvent;
      if (orderItem.isSellOrder) {
        event = {
          ...feedEvent,
          type: FeedEventType.NftListing,
          isSellOrder: true
        };
      } else {
        event = {
          ...feedEvent,
          type: FeedEventType.NftOffer,
          isSellOrder: false
        };
      }
      const newDoc = feedCollection.doc();
      if ('add' in batch) {
        batch.add(newDoc, event, { merge: false });
      } else {
        batch.create(newDoc, event);
      }
    }
  }

  // todo: the below stuff doesn't belong in orders service; commenting to reference this when moved to another repo
  // ===============================================================
  // Buy orders

  // async buyOrders(listId: MarketListId, cursor?: string, limit?: number): Promise<OBOrder[]> {
  //   const orders = await this.orderMap(true, listId, cursor, limit);

  //   return Array.from(orders.values());
  // }

  // async addBuyOrder(listId: MarketListId, buyOrder: OBOrder): Promise<void> {
  //   const c = await this.orderMap(true, listId);

  //   if (!c.has(this.obOrderHash(buyOrder))) {
  //     await this.saveBuyOrder(listId, buyOrder);
  //   } else {
  //     console.log(`addBuyOrder already exists ${this.obOrderHash(buyOrder)} ${listId}`);
  //   }
  // }

  // async saveBuyOrder(listId: MarketListId, buyOrder: OBOrder): Promise<OBOrder> {
  //   const collection = this.firebaseService.firestore
  //     .collection(firestoreConstants.BUY_ORDERS_COLL)
  //     .doc(listId)
  //     .collection('orders');

  //   // Set id to hash
  //   buyOrder.id = this.obOrderHash(buyOrder);

  //   const doc = collection.doc(buyOrder.id);
  //   await doc.set(buyOrder);

  //   return (await doc.get()).data() as OBOrder;
  // }

  // // ===============================================================
  // // Sell orders

  // async sellOrders(listId: MarketListId, cursor?: string, limit?: number): Promise<OBOrder[]> {
  //   const orders = await this.orderMap(false, listId, cursor, limit);

  //   return Array.from(orders.values());
  // }

  // getCollection(buyOrder: boolean, listId: MarketListId): FirebaseFirestore.CollectionReference {
  //   return this.firebaseService.firestore
  //     .collection(buyOrder ? firestoreConstants.BUY_ORDERS_COLL : firestoreConstants.SELL_ORDERS_COLL)
  //     .doc(listId)
  //     .collection('orders');
  // }

  // async getOrder(buyOrder: boolean, listId: MarketListId, id: string) {
  //   const collection = this.getCollection(buyOrder, listId);

  //   return await collection.doc(id).get();
  // }

  // async orderMap(
  //   buyOrder: boolean,
  //   listId: MarketListId,
  //   cursor?: string,
  //   limit?: number
  // ): Promise<Map<string, OBOrder>> {
  //   const collection = this.getCollection(buyOrder, listId);

  //   let result: FirebaseFirestore.QuerySnapshot;
  //   let query: FirebaseFirestore.Query;
  //   if (limit && limit > 0) {
  //     query = collection.limit(limit);

  //     if (cursor) {
  //       // cursor is the order.id (last item of previous result)
  //       const doc = await this.getOrder(buyOrder, listId, cursor);
  //       query = query.startAfter(doc);
  //     }

  //     result = await query.get();
  //   } else {
  //     result = await collection.get();
  //   }

  //   if (result.docs) {
  //     const { results } = docsToArray(result.docs);

  //     const map: Map<string, OBOrder> = new Map();

  //     for (const order of results) {
  //       map.set(order.id, order);
  //     }

  //     return map;
  //   }

  //   return new Map<string, OBOrder>();
  // }

  // async sellOrdersWithParams(listId: MarketListId, collectionAddresses: string[]): Promise<OBOrder[]> {
  //   const result = await this.firebaseService.firestore
  //     .collection(firestoreConstants.SELL_ORDERS_COLL)
  //     .doc(listId)
  //     .collection('orders')
  //     // CollectionAddresses is added on save, it's not part of the OBOrder
  //     .where('collectionAddresses', 'array-contains-any', collectionAddresses)
  //     .get();

  //   if (result.docs) {
  //     const { results } = docsToArray(result.docs);

  //     return results;
  //   }

  //   return [];
  // }

  // async addSellOrder(listId: MarketListId, sellOrder: OBOrder): Promise<void> {
  //   const c = await this.orderMap(false, listId);

  //   if (!c.has(this.obOrderHash(sellOrder))) {
  //     await this.saveSellOrder(listId, sellOrder);
  //   } else {
  //     console.log(`deleteBuyOrder order not found ${this.obOrderHash(sellOrder)} ${listId}`);
  //   }
  // }

  // async saveSellOrder(listId: MarketListId, sellOrder: OBOrder): Promise<OBOrder> {
  //   const collection = this.firebaseService.firestore
  //     .collection(firestoreConstants.SELL_ORDERS_COLL)
  //     .doc(listId)
  //     .collection('orders');

  //   // Set id to hash
  //   sellOrder.id = this.obOrderHash(sellOrder);

  //   // Add collectionAddresses which is used for queries
  //   const collectionAddresses: string[] = [];
  //   for (const nft of sellOrder.nfts) {
  //     collectionAddresses.push(nft.collectionAddress);
  //   }
  //   const saveOrder = sellOrder as SellOrderSave;
  //   saveOrder.collectionAddresses = collectionAddresses;

  //   const doc = collection.doc(saveOrder.id);
  //   await doc.set(saveOrder);

  //   return (await doc.get()).data() as OBOrder;
  // }

  // // ===============================================================
  // // Expired orders

  // async expiredOrders(): Promise<ExpiredCacheItem[]> {
  //   const result: ExpiredCacheItem[] = [];

  //   result.push(...(await this.expiredBuyOrders(MarketListId.ValidActive)));
  //   result.push(...(await this.expiredBuyOrders(MarketListId.ValidInactive)));
  //   // Result.push(...(await expiredBuyOrders('invalid')));

  //   result.push(...(await this.expiredSellOrders(MarketListId.ValidActive)));
  //   result.push(...(await this.expiredSellOrders(MarketListId.ValidInactive)));
  //   // Result.push(...(await expiredSellOrders('invalid')));

  //   return result;
  // }

  // async expiredBuyOrders(listId: MarketListId): Promise<ExpiredCacheItem[]> {
  //   const result: ExpiredCacheItem[] = [];

  //   const orders = await this.buyOrders(listId);
  //   for (const order of orders) {
  //     if (isOBOrderExpired(order)) {
  //       result.push({ listId: listId, order: order });
  //     }
  //   }

  //   return result;
  // }

  // async expiredSellOrders(listId: MarketListId): Promise<ExpiredCacheItem[]> {
  //   const result: ExpiredCacheItem[] = [];

  //   const orders = await this.sellOrders(listId);
  //   for (const order of orders) {
  //     if (isOBOrderExpired(order)) {
  //       result.push({ listId: listId, order: order });
  //     }
  //   }

  //   return result;
  // }

  // // ============= utils =============

  // // todo: this needs to change
  // obOrderHash(obj: OBOrder): string {
  //   const copy = JSON.parse(JSON.stringify(obj));

  //   // we don't want the id part of the hash
  //   copy.id = undefined;

  //   // we don't want the currentPrice part of the hash
  //   // this is set on ActiveSellOrder
  //   copy.currentPrice = undefined;

  //   // added to to sell orders to help queries
  //   copy.collectionAddresses = undefined;

  //   let data = '';

  //   // JSON.stringify can have different results depending on order of keys
  //   // sort keys first
  //   const keys = Object.keys(copy).sort();
  //   for (const key of keys) {
  //     if (key === 'extraParams' || key === 'execParams') {
  //       continue;
  //     } else if (key === 'nfts') {
  //       const collectionAddresses = [];
  //       const ids = [];

  //       for (const item of obj.nfts) {
  //         collectionAddresses.push(item.collectionAddress);
  //         ids.push(...item.tokens);
  //       }

  //       collectionAddresses.sort();
  //       ids.sort((a, b) => {
  //         return a.tokenId.localeCompare(b.tokenId);
  //       });

  //       data += `cols: ${collectionAddresses.toString()}`;
  //       data += `ids: ${ids.toString()}`;
  //     } else {
  //       const val = copy[key];
  //       if (val) {
  //         data += `${key}: ${val.toString()}`;
  //       }
  //     }
  //   }
  //   return createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  // }

  // areOBOrdersEqual(a: OBOrder, b: OBOrder): boolean {
  //   // use ids if set, id is hash
  //   if (a.id && b.id) {
  //     return a.id === b.id;
  //   }

  //   return this.obOrderHash(a) === this.obOrderHash(b);
  // }

  // async deleteOrder(orderId: string) {
  //   if (orderId) {
  //     try {
  //       const docRef = this.firebaseService.firestore.collection(firestoreConstants.ORDERS_COLL).doc(orderId);

  //       await docRef.delete();
  //     } catch (err) {
  //       console.log(err);
  //     }
  //   } else {
  //     console.log('_deleteOrder, id is blank');
  //   }
  // }
}
