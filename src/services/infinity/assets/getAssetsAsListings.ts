import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { getAssetsFromCovalent } from '@services/covalent/getAssetsFromCovalent';
import { getAssetFromOpensea } from '@services/opensea/assets/getAssetFromOpensea';
import { error, log } from '@utils/logger';
import { getAssetAsListing } from '../utils';

export async function fetchAssetAsListingFromDb(chainId: string, tokenId: string, tokenAddress: string, limit: number) {
  log('Getting asset as listing from db');
  try {
    let resp = '';
    const docId = firestore.getAssetDocId({ chainId, tokenId, tokenAddress });
    const doc = await firestore.db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(docId)
      .get();

    if (!doc.exists) {
      if (chainId === '1') {
        // get from opensea
        resp = await getAssetFromOpensea(chainId, tokenId, tokenAddress);
      } else if (chainId === '137') {
        // get from covalent
        resp = await getAssetsFromCovalent(chainId, tokenId, tokenAddress);
      }
    } else {
      resp = await getAssetAsListing(docId, doc.data());
    }
    return resp;
  } catch (err) {
    error('Failed to get asset from db', tokenAddress, tokenId);
    error(err);
  }
}
