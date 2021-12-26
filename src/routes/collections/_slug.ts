import { StatusCode } from '@base/types/StatusCode';
import { getCollectionByAddress } from '@services/infinity/collections/getCollectionByAddress';
import { getCollectionInfoByName } from '@services/infinity/collections/getCollectionInfoByName';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

export const getCollectionInfo = async (req: Request<{ slug: string }>, res: Response) => {
  const slug = req.params.slug;
  log('Fetching collection info for', slug);

  if (ethers.utils.isAddress(slug)) {
    console.log(`is address`);
    const collectionData = await getCollectionByAddress(slug);

    res.send(collectionData);
    return;
  }

  const { success, data, error: err } = await getCollectionInfoByName(slug, 1);

  if (success) {
    const respStr = jsonString(data);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
    return;
  }

  error('Failed to get collection info for', slug, err);
  res.sendStatus(StatusCode.InternalServerError);
};
