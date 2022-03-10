import { StatusCode } from '@infinityxyz/lib/types/core';
import { getChainId } from 'utils/ethers';
import { Request, Response } from 'express';
import { firestore } from 'container';
import { validateInputs } from 'utils';
import { fstrCnstnts } from '../../../../../constants';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';

export const getNftDetails = async (
  req: Request<{ tokenAddress: string; tokenId: string; chain: string }>,
  res: Response
) => {
  const tokenAddress = trimLowerCase(req.params.tokenAddress);
  const tokenId = req.params.tokenId;
  const chain = trimLowerCase(req.params.chain);
  try {
    const errorCode = validateInputs({ tokenAddress, tokenId, chain }, ['tokenAddress', 'tokenId', 'chain']);
    if (errorCode) {
      res.sendStatus(errorCode);
      return;
    }
    const chainId = getChainId(chain);

    const doc = await firestore
      .collection(fstrCnstnts.COLLECTIONS_COLL)
      .doc(`${chainId}:${tokenAddress}`)
      .collection('nfts')
      .doc(tokenId)
      .get();
    if (doc.exists) {
      const docData = doc.data();
      if (!docData) return;
      const imageUrl = docData?.image?.url || docData?.image?.originalUrl;
      const respStr = JSON.stringify({ imageUrl });
      res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
      });
      res.send(respStr);
    } else {
      res.send('');
    }
  } catch (err) {
    error('Failed fetching image for', tokenAddress, tokenId, chain);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
