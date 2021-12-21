import { Router } from 'express';
import { getAssetMetadata } from './_chain/_tokenAddress/_tokenId';
import levelImages from './doge2048/level-images';

const router = Router();

router.get('/:chain/:tokenAddress/:tokenId', getAssetMetadata);

router.use('/doge2048/level-images', levelImages);

export default router;
