import { Router } from 'express';
import leaderboard from './leaderboard';

const router = Router();

router.use('/leaderboard', leaderboard);

export default router;
