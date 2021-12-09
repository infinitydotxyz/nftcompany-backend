import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getProvider } from '@utils/ethers';
import { error } from '@utils/logger';
import { Router, Request } from 'express';
import { generateDoge2048NftMetadata, getDoge2048NftLevelId } from '../metadataUtils';
const router = Router();

// api to get metadata
router.get('/', async (req: Request<{ tokenAddress: string; tokenId: string }>, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId } = req.query;
  try {
    // read data from chain
    const provider = getProvider(chainId as string);
    if (!provider) {
      error('Chain provider is null for chain', chainId);
      res.sendStatus(500);
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
    const levelId = getDoge2048NftLevelId(score, numPlays, dogBalance);
    // check if metadata already generated
    const snapshot = await firestore
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.address', '==', tokenAddress)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.chainId', '==', chainId)
      .get();
    if (snapshot.docs.length > 0) {
    }
    const metadataJson = generateDoge2048NftMetadata(score, numPlays, dogBalance);
  } catch (err) {
    error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
