import { Router } from 'express';
import userAssets from './u/:user/assets';
const router = Router();

router.use('/u/:user/assets', userAssets);

export default router;
