import { Router } from 'express';
import orders from './orders';

const router = Router();

router.use('/orders', orders);

export default router;
