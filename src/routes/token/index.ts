import { Router } from 'express';
import verifiedBonusReward from './:tokenAddress/verifiedBonusReward.js';
const router = Router();

router.use('/:tokenAddress/verifiedBonusReward', verifiedBonusReward);

export default router;
