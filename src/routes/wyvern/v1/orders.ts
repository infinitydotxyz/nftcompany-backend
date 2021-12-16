import { OrderSide } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { getUserOrdersFromDocId } from '@services/infinity/orders/getUserOrderFromDocId';
import { error, log } from '@utils/logger';
import { Router } from 'express';
import { getUserOrdersFromTokenId } from '@services/infinity/orders/getUserOrdersFromTokenId';
import { ethers } from 'ethers';

const router = Router();

/**
 * @swagger
 *  /wyvern/v1/orders:
 *    get:
 *      summary: Fetch an order
 *      parameters:
 *       - in: query
 *         name: maker
 *         type: string
 *         required: false
 *       - in: query
 *         name: id
 *         type: string
 *         required: false
 *       - in: query
 *         name: side
 *         type: string
 *         required: false
 *       - in: query
 *         name: tokenAddress
 *         type: string
 *         required: false
 *       - in: query
 *         name: tokenId
 *         type: string
 *         required: false
 *
 *      responses:
 *        200:
 *          description: Orders for an asset
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  count:
 *                    type: number
 *                    description: Number of orders returned for the requested asset
 *                    example: 1
 *                  orders:
 *                    type: array
 *                    description: List of orders for the asset
 *                    items:
 *                      type: {BaseOrder}
 *                      description: An order for the asset
 */
router.get('/', async (req, res) => {
  const { maker, id, side, tokenAddress, tokenId } = req.query;
  let docId;

  if (id) {
    // @ts-expect-error
    docId = id.trim(); // preserve case
  }

  try {
    let orders = [];

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

    if (docId?.length > 0) {
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
  } catch (err) {
    log('Error while fetching orders');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
