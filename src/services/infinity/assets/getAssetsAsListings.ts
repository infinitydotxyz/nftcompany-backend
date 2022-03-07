import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { getAssetFromCovalent } from 'services/covalent/getAssetFromCovalent';
import { getAssetFromOpensea } from 'services/opensea/assets/getAssetFromOpensea';
import { jsonString } from 'utils/formatters';
import { error, log } from 'utils/logger';
import { getAssetAsListing } from '../utils';
import { getERC721Owner } from 'services/ethereum/checkOwnershipChange';

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
      // todo: adi replace opensea and covalent
      if (chainId === '1') {
        // get from opensea
        listings = await getAssetFromOpensea(chainId, tokenId, tokenAddress);
      } else if (chainId === '137') {
        // get from covalent
        listings = await getAssetFromCovalent(chainId, tokenId, tokenAddress);
      }
    } else {
      const order = doc.data();

      try {
        const schema = order?.metadata?.schema;
        if (order && schema === 'ERC721') {
          /**
           * check ownership change
           * update if necessary
           */
          const savedOwner = order?.metadata?.asset?.owner ?? '';
          const owner = await getERC721Owner(tokenAddress, tokenId, chainId);
          if (owner && owner !== savedOwner) {
            order.metadata.asset.owner = owner;
            doc.ref.update({ 'metadata.asset.owner': owner }).catch(() => {});
          }
        }
      } catch (err) {}

      listings = getAssetAsListing(docId, order);
    }
    return jsonString(listings);
  } catch (err) {
    error('Failed to get asset from db', tokenAddress, tokenId);
    error(err);
  }
}
