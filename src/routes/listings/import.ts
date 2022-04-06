/* eslint-disable prefer-const */
import { ListingType, OrderSide, OrderDirection, StatusCode } from '@infinityxyz/lib/types/core';
import { Request, Response, Router } from 'express';
import { getOpenseaOrders } from 'services/opensea/orders';
import { error, jsonString } from '@infinityxyz/lib/utils';
import { WETH_ADDRESS } from '../../constants';

const router = Router();

router.get('/', async (req: Request<any>, res: Response<any>) => {
  try {
    let {
      assetContractAddress,
      paymentTokenAddress,
      maker,
      taker,
      owner,
      isEnglish,
      bundled,
      includeBundled,
      includeInvalid,
      listedAfter,
      listedBefore,
      tokenId,
      tokenIds,
      side,
      saleKind,
      limit,
      offset,
      orderBy,
      orderDirection,
      chainId
    } = req.query;

    let listingType = saleKind === '1' ? ListingType.DutchAuction : ListingType.FixedPrice;
    if (isEnglish) {
      listingType = ListingType.EnglishAuction;
    }

    /**
     * Limit to eth and weth
     */
    if (!chainId || chainId === '1') {
      paymentTokenAddress = listingType === ListingType.EnglishAuction ? WETH_ADDRESS : '';
    }

    const data = await getOpenseaOrders({
      assetContractAddress: assetContractAddress as string,
      paymentTokenAddress: paymentTokenAddress as string,
      maker: maker as string,
      taker: taker as string,
      owner: owner as string,
      isEnglish: Boolean(isEnglish),
      bundled: Boolean(bundled),
      includeBundled: Boolean(includeBundled),
      includeInvalid: Boolean(includeInvalid),
      listedAfter: Number.isNaN(Number(listedAfter)) ? undefined : Number(listedAfter),
      listedBefore: Number.isNaN(Number(listedBefore)) ? undefined : Number(listedBefore),
      tokenId: tokenId as string,
      tokenIds: tokenIds as string[],
      side: Number.isNaN(Number(side)) ? undefined : (Number(side) as OrderSide),
      saleKind: Number.isNaN(Number(saleKind)) ? undefined : Number(saleKind),
      limit: Number.isNaN(Number(limit)) ? undefined : Number(limit),
      offset: Number.isNaN(Number(offset)) ? undefined : Number(offset),
      orderBy: orderBy as string,
      orderDirection: orderDirection as string as OrderDirection
    });

    const stringifiedResp = jsonString(data);
    if (data && stringifiedResp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(stringifiedResp ?? '', 'utf8')
      });
      res.send(stringifiedResp);
      return;
    }

    res.sendStatus(StatusCode.InternalServerError);
  } catch (err) {
    error('Error occurred while getting opensea orders');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
