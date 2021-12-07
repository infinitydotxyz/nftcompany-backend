import { Router } from 'express';
import verifiedBonusReward from './:tokenAddress/verifiedBonusReward.js';
const router = Router();

router.use('/token', verifiedBonusReward);

export default router;
