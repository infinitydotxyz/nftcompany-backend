import { StatusCode } from '@infinityxyz/types/core/StatusCode';
import { saveCollectionTraits } from '@services/infinity/collections/saveCollectionTraits';
import { getCollectionTraitsFromOpensea } from '@services/opensea/collection/getCollectionTraitsFromOpensea';

import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

/**
 * @typedef { import("@infinityxyz/types/wyvern/TraitWithValues").WyvernTraitWithValues } WyvernTraitWithValues
 */

/**
 * @typedef {Object} TraitsResponse
 * @property {number} count
 * @property {array<WyvernTraitWithValues>} traits
 */

/**
 * GET /collections/{address}/traits
 * @tags collections
 * @summary Get the traits for a collection
 * @description Get the traits for a collection via the collection address
 * @param {string} address.path.required - address of the collection to get traits for
 * @return {TraitsResponse} 200 - Success response
 * @return 400 - Bad request response (invalid address)
 * @return 500 - Server error response
 */
const getTraits = async (req: Request<{ id: string }, any, any, { chainId: string }>, res: Response) => {
  log('Fetching traits from NFT contract address.');
  const contractAddress = req.params.id.trim().toLowerCase();
  // const chainId = req.query.chainId?.trim?.();
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
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
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
