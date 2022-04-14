import { OrderSide, StatusCode } from '@infinityxyz/lib/types/core';
import { getUserOrdersFromDocId } from 'services/infinity/orders/getUserOrderFromDocId';
import { error, log } from '@infinityxyz/lib/utils';
import { Router } from 'express';
import { getUserOrdersFromTokenId } from 'services/infinity/orders/getUserOrdersFromTokenId';
import { ethers } from 'ethers';

const router = Router();

/**
 * @typedef { import("@infinityxyz/lib/types/core';
 */

/**
 * @typedef {Object} OrderResponse
 * @property {number} count
 * @property {array<Order>} orders
 */

/**
 * GET /wyvern/v1/orders
 * @tags orders
 * @summary Get orders for an asset
 * @description Get a list of orders for an asset
 * ### Queries
 * - by asset id
 * - by token address, token id,  maker address and order side
 * @param {string} id.query
 * @param {string} tokenAddress.query
 * @param {string} tokenId.query
 * @param {string} maker.query
 * @param {string} side.query
 * @return {OrderResponse} 200 - Success response
 * @return 400 - Bad request response
 * @return 500 - Server error response
 */
router.get('/', async (req, res) => {
  const { maker, id, side, tokenAddress, tokenId } = req.query;
  let docId;

  if (id && typeof id === 'string') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    docId = id.trim(); // Preserve case
  }

  try {
    let orders: any[] = [];

    const normalizedMaker = (maker as string)?.trim?.()?.toLowerCase?.();
    const orderSide = Number(side as string) as OrderSide;
    const normalizedTokenAddress = (tokenAddress as string)?.trim?.()?.toLowerCase?.();

    if (!normalizedMaker || !ethers.utils.isAddress(normalizedMaker)) {
      log(`Invalid maker address: ${normalizedMaker}`);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (orderSide !== OrderSide.Buy && orderSide !== OrderSide.Sell) {
      log(`Invalid order side: ${orderSide}`);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (docId) {
      orders = await getUserOrdersFromDocId(normalizedMaker, docId, orderSide);
    } else {
      if (!normalizedTokenAddress || !ethers.utils.isAddress(normalizedTokenAddress)) {
        log(`Invalid token address: ${normalizedTokenAddress}`);
        res.sendStatus(StatusCode.BadRequest);
        return;
      }

      if (!tokenId) {
        log(`Invalid token id: ${tokenId}`);
        res.sendStatus(StatusCode.BadRequest);
        return;
      }

      orders = await getUserOrdersFromTokenId(normalizedMaker, normalizedTokenAddress, tokenId as string, orderSide);
    }

    if (orders && Array.isArray(orders)) {
      res.send({
        count: orders.length,
        orders
      });
      return;
    }

    log('Invalid orders');
    res.sendStatus(StatusCode.BadRequest);
  } catch (err: any) {
    log('Error while fetching orders');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
