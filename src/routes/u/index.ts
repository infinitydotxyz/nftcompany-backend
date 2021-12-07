import { Router } from 'express';
import { authorizeUser } from '@base/middleware/auth.js';

const router = Router();

router.use('/u', authorizeUser);

export default router;
