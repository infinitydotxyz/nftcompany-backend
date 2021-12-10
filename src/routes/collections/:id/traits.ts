import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getOpenseaCollectionTraits } from '@services/opensea/collection/traits';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { Request, Response } from 'express';

// get traits & their values of a collection
const getTraits = async (req: Request<{ id: string }>, res: Response) => {
  log('Fetching traits from NFT contract address.');
  const contractAddress = req.params.id.trim().toLowerCase();
  let resp = {};

  try {
    const traits = await getOpenseaCollectionTraits(contractAddress);
    resp = {
      traits
    };

    // store in firestore for future use
    firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(contractAddress).set(resp, { merge: true });

    // return response
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

export { getTraits };
