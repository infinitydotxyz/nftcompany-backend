import { Router } from 'express';

import collectionUserRouter from './u';

const router = Router();

router.use('/u', collectionUserRouter);

export default router;
