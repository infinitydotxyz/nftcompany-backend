import { Router } from 'express';
import txns from './txns';
import orders from './orders';

const router = Router();

router.use('/txns', txns);
router.use('/orders', orders);

export default router;
