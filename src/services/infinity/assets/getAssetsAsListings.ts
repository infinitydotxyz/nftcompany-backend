import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import { getAssetFromCovalent } from '@services/covalent/getAssetFromCovalent';
import { getAssetFromOpensea } from '@services/opensea/assets/getAssetFromOpensea';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { getAssetAsListing } from '../utils';

export async function fetchAssetAsListingFromDb(chainId: string, tokenId: string, tokenAddress: string, limit: number) {
  log('Getting asset as listing from db');
  try {
    const docId = firestore.getAssetDocId({ chainId, tokenId, tokenAddress });
    const doc = await firestore.db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(docId)
      .get();

    let listings;
    if (!doc.exists) {
      if (chainId === '1') {
        // get from opensea
        listings = await getAssetFromOpensea(chainId, tokenId, tokenAddress);
      } else if (chainId === '137') {
        // get from covalent
        listings = await getAssetFromCovalent(chainId, tokenId, tokenAddress);
      }
    } else {
      listings = getAssetAsListing(docId, doc.data());
    }
    return jsonString(listings);
  } catch (err) {
    error('Failed to get asset from db', tokenAddress, tokenId);
    error(err);
  }
}
