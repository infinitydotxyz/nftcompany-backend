import { firestore } from 'container';
import { OrderSide, StatusCode } from '@infinityxyz/lib/types/core';
import { NFTC_FEE_ADDRESS } from '../../../../../constants';
import { hasBonusReward } from 'services/infinity/collections/hasBonusReward';
import { postListing } from 'services/infinity/listings/postListing';
import { postOffer } from 'services/infinity/offers/postOffer';
import { error, log, trimLowerCase } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';

// post a listing or make offer
export const postUserOrders = async (req: Request<{ user: string }>, res: Response) => {
  const payload = req.body;

  if (Object.keys(payload).length === 0) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  if (
    !payload ||
    !payload.hash ||
    !payload.metadata ||
    !payload.metadata.asset ||
    !payload.metadata.asset.address ||
    !payload.metadata.asset.collectionName ||
    !payload.metadata.asset.searchCollectionName ||
    !payload.metadata.basePriceInEth
  ) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  if (
    !payload.englishAuctionReservePrice &&
    (!payload.feeRecipient || payload.feeRecipient.trim().toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase())
  ) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  if (payload.metadata.asset.id === undefined || payload.metadata.asset.id === null) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();

  const maker = trimLowerCase(req.params.user);
  if (!maker) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  // default one order per post call
  const numOrders = 1;
  const batch = firestore.db.batch();
  log(`Making an order for user: ${maker}`);
  try {
    // check if token has bonus if payload instructs so
    let hasBonus = payload.metadata.hasBonusReward;
    if (payload.metadata.checkBonusReward) {
      hasBonus = await hasBonusReward(tokenAddress);
    }
    payload.metadata.hasBonusReward = hasBonus;

    if (payload.side === OrderSide.Sell) {
      // listing
      await postListing(maker, payload, batch, numOrders, hasBonus);
    } else if (payload.side === OrderSide.Buy) {
      // offer
      await postOffer(maker, payload, batch, numOrders, hasBonus);
    } else {
      error('Unknown order type');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // commit batch
    log('Committing post order batch to firestore');
    await batch.commit();
    res.send(payload);
    return;
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
