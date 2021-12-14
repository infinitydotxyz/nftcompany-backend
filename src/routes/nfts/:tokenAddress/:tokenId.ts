import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getProvider } from '@utils/ethers';
import { error } from '@utils/logger';
import { Request, Response } from 'express';
// import { getDoge2048NftLevelId } from '../metadataUtils';

// import { uploadSourceImages, testUpload, urlForDogeImage } from './doge_builder/images';

// todo: adi change this
// const dogeAbi = require('./abis/doge2048nft.json');
// import dogeAbi from '@base/abi/doge2048nft.json';
import { testUpload, urlForDogeImage } from './doge_builder/images';

// used for uploading the doge source images
// and testing creating and uploading an NFT based on metadata
// todo : adi remove in prod
export const getSetup = async (req: Request<{ tokenAddress: string; tokenId: string }>, res: Response) => {
  try {
    // await uploadSourceImages();
    // res.send('uploaded');
    const result = await testUpload();
    res.send(result);
  } catch (err) {
    console.log(err);

    res.send(err);
  }
};

// api to get metadata
export const getAssetMetadata = async (req: Request<{ tokenAddress: string; tokenId: string }>, res: Response) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId } = req.query;
  try {
    // read data from chain
    const provider = getProvider(chainId as string);
    if (provider == null) {
      error('Chain provider is null for chain', chainId);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // todo: adi generalize this
    // todo: adi change this
    // const contract = new ethers.Contract(tokenAddress, dogeAbi, provider);
    // const score = contract.score();
    // const numPlays = contract.numPlays();
    // const dogBalance = contract.getTokenBalance();
    const score = 1000;
    const numPlays = 10;
    const dogBalance = 10;
    // const levelId = getDoge2048NftLevelId(score, numPlays, dogBalance);
    // check if metadata already generated
    const snapshot = await firestore
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.address', '==', tokenAddress)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.chainId', '==', chainId)
      .get();
    if (snapshot.docs.length > 0) {
      console.log(snapshot.docs);
    }

    const url = await urlForDogeImage(score, numPlays, dogBalance);
    const result = { nftUrl: url };

    res.send(JSON.stringify(result));
  } catch (err) {
    error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
