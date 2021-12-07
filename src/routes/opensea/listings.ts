import { Router } from 'express';

const router = Router();

// fetch listings from opensea api
/**
 * supports queries
 * - query owner, tokenAddresses or tokenAddress, tokenIds,
 * - query tokenAddress, tokenIds
 * - query tokenAddresses, tokenIds
 * - query collection
 * - filters: offset, limit (max 50)
 * - sorting: orderBy: 'asc' | 'desc' orderDirection: 'sale_date' | 'sale_count' | 'sale_price'
 */
router.get('/listings', async (req, res) => {
  const { owner, tokenIds, tokenAddress, tokenAddresses, orderBy, orderDirection, offset, limit, collection } =
    req.query;

  //   const assetContractAddress = tokenAddress;
  //   const assetContractAddresses = tokenAddresses;
  //   const resp = await fetchAssetsFromOpensea(
  //     owner,
  //     tokenIds,
  //     assetContractAddress,
  //     assetContractAddresses,
  //     orderBy,
  //     orderDirection,
  //     offset,    limit,
  //     collection
  //   );
  //   const stringifiedResp = utils.jsonString(resp);
  //   if (stringifiedResp) {
  //     res.set({
  //       'Cache-Control': 'must-revalidate, max-age=60',
  //       'Content-Length': Buffer.byteLength(stringifiedResp, 'utf8')
  //     });
  //     res.send(stringifiedResp);
  //   } else {
  res.sendStatus(500);
  //   }
});

export default router;
