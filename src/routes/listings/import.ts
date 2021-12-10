import { OrderSide } from '@base/types/NftInterface';
import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { jsonString } from '@utils/formatters';
import { Router } from 'express';
import { getOpenseaOrders } from '@services/opensea/orders';
import { error } from '@utils/logger';

const router = Router();

router.get('/', async (req, res) => {
  const {
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
    orderDirection
  } = req.query;

  const {
    success,
    data,
    error: err
  } = await getOpenseaOrders({
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
  if (success) {
    if (stringifiedResp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(stringifiedResp, 'utf8')
      });
      res.send(stringifiedResp);
      return;
    } else {
      res.sendStatus(StatusCode.InternalServerError);
      return;
    }
  }

  if (err) {
    error(err);
  }
  res.sendStatus(StatusCode.InternalServerError);
});

export default router;
