import { Router } from 'express';
import { getVerifiedBonusReward } from './_tokenAddress/verifiedBonusReward.js';
const router = Router();

router.get('/:tokenAddress/verifiedBonusReward', getVerifiedBonusReward);

export default router;
