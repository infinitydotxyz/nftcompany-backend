import { Router } from 'express';
import { getUserAssets } from './u/:user/assets';
const router = Router();

router.get('/u/:user/assets', getUserAssets);

export default router;
