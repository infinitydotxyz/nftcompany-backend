import { StatusCode } from '@base/types/StatusCode';
import { getOrdersByTokenId } from '@services/infinity/orders/getOrdersByTokenId';
import { getOpenseaEvents } from '@services/opensea/events';
import { getRawOpenseaOrdersByTokenAddress } from '@services/opensea/orders';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Request, Router } from 'express';
import { stringify } from 'qs';

const router = Router();

// transaction events (for a collection or a token)
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
    const assetContractAddress = req.query.assetContractAddress;
    const onlyOpenSea = false;
    const offset = req.query.offset;
    const limit = req.query.limit;

    const queryStr = decodeURIComponent(
      stringify(
        {
          ...(tokenId ? { token_id: req.query.tokenId } : {}),
          asset_contract_address: assetContractAddress,
          only_opensea: `${onlyOpenSea}`,
          event_type: eventType,
          offset,
          limit
        },
        { arrayFormat: 'repeat' }
      )
    );

    let respStr = '';
    try {
      // have to fetch order data from a diff end point if token id is supplied
      if (eventType === 'bid_entered' && tokenId) {
        const data = await fetchOffersFromOSAndInfinity(req);
        respStr = jsonString(data);
      } else if (chainId !== '1') {
        res.sendStatus(StatusCode.BadRequest);
        return;
      } else {
        const data = await getOpenseaEvents(queryStr);
        respStr = jsonString(data);
      }
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
      });
      res.send(respStr);
    } catch (err) {
      error('Error occured while fetching events from opensea');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  }
);

// fetches offers from both OS and Infinity
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
  const offset = req.query.offset;
  const chainId = req.query.chainId;

  try {
    const getInfinityOrdersPromise = async () => {
      return await getOrdersByTokenId(tokenAddress, tokenId, limit);
    };

    const getOpenseaOrdersPromise = async () => {
      if (chainId !== '1') {
        return [];
      }
      const data = await getRawOpenseaOrdersByTokenAddress(tokenAddress, limit, offset, tokenId);
      const assetEvents: any[] = [];
      for (const order of data?.orders || []) {
        const obj = {
          asset: {
            name: order.asset.name,
            token_id: order.asset.token_id,
            image_thumbnail_url: order.asset.image_thumbnail_url
          },
          from_account: {
            address: order.maker.address
          },
          to_account: {
            address: order.asset.owner.address
          },
          chainId: '1', // assuming opensea is only used for eth mainnet
          created_date: order.listing_time * 1000,
          offerSource: 'OpenSea',
          bid_amount: order.base_price,
          event_type: 'bid_entered'
        };

        assetEvents.push(obj);
      }

      return assetEvents;
    };

    const [infinityEvents, openseaEvents] = await Promise.all([getInfinityOrdersPromise(), getOpenseaOrdersPromise()]);

    const infinityEventsArray = infinityEvents || [];
    const openseaEventsArray = openseaEvents || [];

    return {
      asset_events: [...infinityEventsArray, ...openseaEventsArray]
    };
  } catch (err) {
    error('Error occured while fetching events from opensea');
    error(err);
  }
}

export default router;
