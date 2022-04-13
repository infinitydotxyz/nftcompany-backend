import { StatusCode } from '@infinityxyz/lib/types/core';
import { getOrdersByTokenId } from 'services/infinity/orders/getOrdersByTokenId';
import { Request, Router } from 'express';
import { error, jsonString } from '@infinityxyz/lib/utils';

const router = Router();

// Transaction events (for a collection or a token)
router.get(
  '/',
  async (
    req: Request<
      any,
      any,
      any,
      {
        tokenId: string;
        eventType: string;
        assetContractAddress: string;
        offset: string;
        limit: string;
        chainId: string;
      }
    >,
    res
  ) => {
    const tokenId = req.query.tokenId;
    const eventType = req.query.eventType;
    const chainId = req.query.chainId;

    let respStr = '';
    try {
      // Have to fetch order data from a diff end point if token id is supplied
      if (eventType === 'bid_entered' && tokenId) {
        const data = await fetchOffersFromOSAndInfinity(req);
        respStr = jsonString(data);
      } else if (chainId !== '1') {
        res.sendStatus(StatusCode.BadRequest);
        return;
      }
      // To enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
      });
      res.send(respStr);
    } catch (err: any) {
      error('Error occured while fetching events from opensea');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  }
);

// Fetches offers from both OS and Infinity
export async function fetchOffersFromOSAndInfinity(
  req: Request<
    any,
    any,
    any,
    {
      tokenId: string;
      eventType: string;
      assetContractAddress: string;
      offset: string;
      limit: string;
      chainId: string;
    }
  >
) {
  const tokenAddress = req.query.assetContractAddress ?? '';
  const tokenId = req.query.tokenId ?? '';
  const limit = +req.query.limit ?? 50;

  try {
    const getInfinityOrdersPromise = async () => {
      return await getOrdersByTokenId(tokenAddress, tokenId, limit);
    };

    const [infinityEvents] = await Promise.all([getInfinityOrdersPromise()]);

    const infinityEventsArray = infinityEvents || [];

    return {
      asset_events: [...infinityEventsArray]
    };
  } catch (err: any) {
    error('Error occured while fetching events from opensea');
    error(err);
  }
}

export default router;
