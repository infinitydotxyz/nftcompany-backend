import { StatusCode } from '@base/types/StatusCode';
import { saveCollectionTraits } from '@services/infinity/collections/saveCollectionTraits';
import { getCollectionTraitsFromOpensea } from '@services/opensea/collection/getCollectionTraitsFromOpensea';

import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

// get traits & their values of a collection
const getTraits = async (req: Request<{ id: string }>, res: Response) => {
  log('Fetching traits from NFT contract address.');
  const contractAddress = req.params.id.trim().toLowerCase();
  let resp = {};

  if (!ethers.utils.isAddress(contractAddress)) {
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const traits = await getCollectionTraitsFromOpensea(contractAddress);

    resp = {
      traits
    };
    // store in firestore for future use
    if (traits) {
      void saveCollectionTraits(contractAddress, traits);
    }

    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
    return;
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

export { getTraits };
