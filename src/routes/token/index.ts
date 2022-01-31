import { Router } from 'express';
import { getVerifiedBonusReward } from './_tokenAddress/verifiedBonusReward';
const router = Router();

router.get('/:tokenAddress/verifiedBonusReward', getVerifiedBonusReward);

export default router;
