import { firestore } from '@base/container';
import { fstrCnstnts, OPENSEA_API } from '@constants';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import axios from 'axios';
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
      const authKey = process.env.openseaKey;
      const url = OPENSEA_API + `events?${queryStr}`;
      const options = {
        headers: {
          'X-API-KEY': authKey
        }
      };
      const { data } = await axios.get(url, options);
      // append chain id assuming opensea is only used for eth mainnet
      for (const obj of data.asset_events) {
        obj.chainId = '1';
      }
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
    res.sendStatus(500);
  }
});

// fetches offers from both OS and Infinity
export async function fetchOffersFromOSAndInfinity(req: Request) {
  const tokenAddress = req.query.asset_contract_address || '';
  const tokenId = req.query.token_id;
  const limit = +req.query.limit;
  const offset = req.query.offset;
  const authKey = process.env.openseaKey;
  const url = 'https://api.opensea.io/wyvern/v1/orders';
  const options: any = {
    headers: {
      'X-API-KEY': authKey
    },
    params: {
      side: 0,
      asset_contract_address: tokenAddress,
      limit,
      offset
    }
  };

  if (tokenId) {
    options.params.token_id = tokenId;
  }

  const result: { asset_events: any[] } = {
    asset_events: []
  };
  try {
    // infinity offers
    let query = firestore.db
      .collectionGroup(fstrCnstnts.OFFERS_COLL)
      .where('metadata.asset.address', '==', tokenAddress);
    if (tokenId) {
      query = query.where('metadata.asset.id', '==', tokenId);
    }
    query = query.orderBy('metadata.basePriceInEth', 'desc').limit(limit);

    const snapshot = await query.get();

    for (const offer of snapshot.docs) {
      const order = offer.data();
      const obj = {
        asset: {
          token_id: order.metadata.asset.id,
          image_thumbnail_url: order.metadata.asset.image,
          name: order.metadata.asset.title
        },
        created_date: order.listingTime * 1000,
        from_account: {
          address: order.maker
        },
        chainId: order.metadata.chainId,
        bid_amount: order.base_price,
        offerSource: 'Infinity'
      };
      result.asset_events.push(obj);
    }

    // opensea offers
    const { data } = await axios.get(url, options);
    for (const order of data.orders) {
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
      result.asset_events.push(obj);
    }
  } catch (err) {
    error('Error occured while fetching events from opensea');
    error(err);
  }
  return result;
}

export default router;
