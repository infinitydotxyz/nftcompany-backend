import { OPENSEA_API } from '@constants';
import { error, log } from '@utils/logger';
import axios from 'axios';
import { Router } from 'express';

const router = Router();

// router.use('/opensea');
// TODO add listings endpoint

export default router;

export async function fetchAssetFromOpensea(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Opensea');
  try {
    const url = OPENSEA_API + 'asset/' + tokenAddress + '/' + tokenId;
    const authKey = process.env.openseaKey;
    const options = {
      headers: {
        'X-API-KEY': authKey
      }
    };
    const { data } = await axios.get(url, options);
    // store asset for future use
    return await saveRawOpenseaAssetInDatabase(chainId, data);
  } catch (err) {
    error('Failed to get asset from opensea', tokenAddress, tokenId);
    error(err);
  }
}

async function saveRawOpenseaAssetInDatabase(chainId, rawAssetData) {
  try {
    const assetData = {};
    const marshalledData = await openseaAssetDataToListing(chainId, rawAssetData);
    assetData.metadata = marshalledData;
    assetData.rawData = rawAssetData;

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = db
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(getAssetDocId({ tokenAddress, tokenId, chainId }));
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    utils.error('Error occured while saving asset data in database');
    utils.error(err);
  }
}
