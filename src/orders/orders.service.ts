import { error, firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { ORDER_VALID_ACTIVE } from '../constants';
import FirestoreBatchHandler from 'databases/FirestoreBatchHandler';
import { FirebaseService } from 'firebase/firebase.service';
import { getDocIdHash } from 'utils';
import { FirestoreOrder, FirestoreOrderItem } from './firestore-order';
import { SignedOBOrderDto } from './signed-ob-order.dto';

@Injectable()
export default class OrdersService {
  constructor(private firebaseService: FirebaseService) {}

  postOrders(orders: SignedOBOrderDto[]) {
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
          const collection = nft.collectionAddress;
          for (const token of nft.tokens) {
            // get data
            const tokenId = token.tokenId.toString();
            const orderItemData = this.getPartialFirestoreOrderItemFromSignedOBOrder(order);
            orderItemData.collection = collection;
            orderItemData.tokenId = tokenId;
            orderItemData.numTokens = token.numTokens;

            // get doc id
            const orderItemDocRef = orderItemsRef.doc(
              getDocIdHash({ collectionAddress: collection, tokenId, chainId: order.chainId })
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

  getFirestoreOrderFromSignedOBOrder(order: SignedOBOrderDto): FirestoreOrder {
    const data: FirestoreOrder = {
      id: order.id,
      orderStatus: ORDER_VALID_ACTIVE,
      chainId: order.chainId,
      isSellOrder: order.isSellOrder,
      numItems: order.numItems,
      startPriceWei: order.startPriceWei,
      startPriceEth: order.startPriceEth,
      endPriceWei: order.endPriceWei,
      endPriceEth: order.endPriceEth,
      startTimeMs: order.startTimeMs,
      endTimeMs: order.endTimeMs,
      minBpsToSeller: order.minBpsToSeller,
      nonce: order.nonce,
      complicationAddress: order.execParams.complicationAddress,
      currencyAddress: order.execParams.currencyAddress,
      makerAddress: order.makerAddress,
      makerUsername: order.makerUsername,
      takerAddress: order.takerAddress,
      takerUsername: order.takerUsername,
      signedOrder: order.signedOrder
    };
    return data;
  }

  getPartialFirestoreOrderItemFromSignedOBOrder(order: SignedOBOrderDto): Partial<FirestoreOrderItem> {
    const data: Partial<FirestoreOrderItem> = {
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
      takerAddress: order.takerAddress,
      takerUsername: order.takerUsername
    };
    return data;
  }
}
