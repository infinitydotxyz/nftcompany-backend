import { fetchAssetsOfUser } from '@routes/u/:user/assets';
import { Router } from 'express';

const router = Router();

router.get('/:user/assets', (req, res) => {
  fetchAssetsOfUser(req, res);
});

export default router;
