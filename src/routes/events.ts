import { StatusCode } from '@base/types/StatusCode';
import { getOrdersByTokenId } from '@services/infinity/orders/getOrdersByTokenId';
import { getOpenseaEvents } from '@services/opensea/events';
import { getRawOpenseaOrdersByTokenAddress } from '@services/opensea/orders';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Request, Router } from 'express';
import qs from 'qs';

const router = Router();

// transaction events (for a collection or a token)
// todo: adi take chainId
router.get('/', async (req, res) => {
  const queryStr = decodeURIComponent(qs.stringify(req.query));
  const tokenId = req.query.token_id;
  const eventType = req.query.event_type;
  let respStr = '';
  try {
    // have to fetch order data from a diff end point if token id is supplied
    if (eventType === 'bid_entered' && tokenId) {
      const data = await fetchOffersFromOSAndInfinity(req);
      respStr = jsonString(data);
    } else {
      const data = await getOpenseaEvents(queryStr);
      respStr = jsonString(data);
    }
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Error occured while fetching events from opensea');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

// fetches offers from both OS and Infinity
export async function fetchOffersFromOSAndInfinity(req: Request) {
  const tokenAddress = req.query.asset_contract_address ?? '';
  const tokenId = req.query.token_id ?? '';
  const limit = +(req.query.limit as string) ?? 50;
  const offset = req.query.offset;

  try {
    const getInfinityOrdersPromise = async () => {
      return await getOrdersByTokenId(tokenAddress as string, tokenId as string, limit);
    };

    const getOpenseaOrdersPromise = async () => {
      const data = await getRawOpenseaOrdersByTokenAddress(
        tokenAddress as string,
        limit,
        offset as string,
        tokenId as string
      );
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
          chainId: '1', // assuming opensea is only used for eth mainnet
          created_date: order.listing_time * 1000,
          offerSource: 'OpenSea',
          bid_amount: order.base_price
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
