import { error, firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { ORDER_VALID_ACTIVE } from '../constants';
import FirestoreBatchHandler from 'databases/FirestoreBatchHandler';
import { FirebaseService } from 'firebase/firebase.service';
import { getDocIdHash } from 'utils';
import { SignedOBOrderDto } from './signed-ob-order.dto';
import { FirestoreOrder, FirestoreOrderItem } from '@infinityxyz/lib/types/core';
import { OBOrderItemDto } from './ob-order-item.dto';
import { OBTokenInfoDto } from './ob-token-info.dto';

@Injectable()
export default class OrdersService {
  constructor(private firebaseService: FirebaseService) {}

  postOrders(userId: string, orders: SignedOBOrderDto[]) {
    const fsBatchHandler = new FirestoreBatchHandler();
    const ordersCollectionRef = this.firebaseService.firestore.collection(firestoreConstants.ORDERS_COLL);
    for (const order of orders) {
      // get data
      const dataToStore = this.getFirestoreOrderFromSignedOBOrder(order);
      // save
      const docRef = ordersCollectionRef.doc(order.id);
      fsBatchHandler.add(docRef, dataToStore, { merge: true });

      // get order items
      const orderItemsRef = docRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL);
      try {
        for (const nft of order.nfts) {
          for (const token of nft.tokens) {
            // get data
            const tokenId = token.tokenId.toString();
            const orderItemData = this.getFirestoreOrderItemFromSignedOBOrder(order, nft, token);
            // get doc id
            const orderItemDocRef = orderItemsRef.doc(
              getDocIdHash({ collectionAddress: nft.collectionAddress, tokenId, chainId: order.chainId })
            );
            // add to batch
            fsBatchHandler.add(orderItemDocRef, orderItemData, { merge: true });
          }
        }
      } catch (err: any) {
        error('Failed saving orders to firestore', err);
      }
    }
    // commit batch
    fsBatchHandler.flush().catch((err) => {
      error(err);
    });
  }

  async getOrders(params: any) {
    console.log(params); // todo: remove
    // todo: remove any
    const ordersCollectionRef = this.firebaseService.firestore.collection(firestoreConstants.ORDERS_COLL);
    // todo: needs pagination
    const query = ordersCollectionRef.where('orderStatus', '==', ORDER_VALID_ACTIVE);
    const orders = await query.get();
    // todo: change this
    const results: FirebaseFirestore.DocumentData[] = [];
    orders.forEach((doc) => {
      const order = doc.data();
      const orderItems: FirestoreOrderItem[] = [];
      doc.ref
        .collection(firestoreConstants.ORDER_ITEMS_SUB_COLL)
        .get()
        .then((items) => {
          items.forEach((orderItemDoc) => {
            const orderItem = orderItemDoc.data() as FirestoreOrderItem;
            orderItems.push(orderItem);
          });
        })
        .catch((err) => {
          error(err);
        });
      order.nfts = orderItems;
      results.push(order);
    });
    return {
      orders: results
    };
  }

  getFirestoreOrderFromSignedOBOrder(order: SignedOBOrderDto): FirestoreOrder {
    const data: FirestoreOrder = {
      id: order.id,
      orderStatus: ORDER_VALID_ACTIVE,
      chainId: order.chainId,
      isSellOrder: order.isSellOrder,
      numItems: order.numItems,
      startPriceEth: order.startPriceEth,
      endPriceEth: order.endPriceEth,
      startTimeMs: order.startTimeMs,
      endTimeMs: order.endTimeMs,
      minBpsToSeller: order.minBpsToSeller,
      nonce: order.nonce,
      complicationAddress: order.execParams.complicationAddress,
      currencyAddress: order.execParams.currencyAddress,
      makerAddress: order.makerAddress,
      makerUsername: order.makerUsername,
      signedOrder: order.signedOrder
    };
    return data;
  }

  getFirestoreOrderItemFromSignedOBOrder(
    order: SignedOBOrderDto,
    nft: OBOrderItemDto,
    token: OBTokenInfoDto
  ): FirestoreOrderItem {
    const data: FirestoreOrderItem = {
      id: order.id,
      orderStatus: ORDER_VALID_ACTIVE,
      chainId: order.chainId,
      isSellOrder: order.isSellOrder,
      numItems: order.numItems,
      startPriceEth: order.startPriceEth,
      endPriceEth: order.endPriceEth,
      startTimeMs: order.startTimeMs,
      endTimeMs: order.endTimeMs,
      makerAddress: order.makerAddress,
      makerUsername: order.makerUsername,
      takerAddress: token.takerAddress,
      takerUsername: token.takerUsername,
      collection: nft.collectionAddress,
      collectionName: nft.collectionName,
      collectionImage: nft.collectionImage,
      tokenId: token.tokenId,
      numTokens: token.numTokens,
      tokenImage: token.tokenImage,
      tokenName: token.tokenName
    };
    return data;
  }
}
