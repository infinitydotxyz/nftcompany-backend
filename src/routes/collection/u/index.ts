import { authenticateUser, authorizeCollectionEditor } from 'middleware/auth';
import { Router } from 'express';
import { getCollectionInfo, postCollectionInfo } from './_user/_collection';
import fileUpload from 'express-fileupload';
const router = Router();

router.use('/:user/:collection', authenticateUser);
router.use('/:user/:collection', authorizeCollectionEditor);

router.get('/:user/:collection', getCollectionInfo);
router.post('/:user/:collection', fileUpload(), postCollectionInfo);

export default router;
