import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { CovalentWalletBalanceItem } from '@infinityxyz/lib/types/services/covalent';
import { covalentAssetDataToListing } from 'services/covalent/utils';
import { error } from 'utils/logger';
import { getAssetAsListing } from '../utils';

export async function saveRawCovalentAssetInDatabase(chainId: string, nftMetadata: CovalentWalletBalanceItem) {
  try {
    const marshalledData = await covalentAssetDataToListing(chainId, nftMetadata);
    const assetData = {
      metadata: marshalledData,
      rawData: nftMetadata
    };

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(firestore.getAssetDocId({ tokenAddress, tokenId, chainId }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    error('Error occured while saving asset data in database');
    error(err);
  }
}
