import { fetchAssetsOfUser } from '@routes/u/:user/assets';
import { Router, Request } from 'express';

const router = Router();

router.get('/', (req: Request<{ user: string }>, res) => {
  fetchAssetsOfUser(req, res);
});

export default router;
