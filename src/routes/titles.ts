import { StatusCode } from '@base/types/StatusCode';
import { fuzzySearchTitle } from '@services/infinity/collections/fuzzySearchTitle';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

/**
 * @swagger
 *  /titles:
 *    get:
 *      summary: search for assets containing the startsWith substring.
 *      parameters:
 *       - in: query
 *         name: startsWith
 *         type: string
 *         required: false
 *      responses:
 *        200:
 *          description: A list assets matching the startsWith string
 *          content:
 *            application/json:
 *              schema:
 *                type: array
 *                items:
 *                  type: object
 *                  properties:
 *                    title:
 *                      type: string
 *                      description: Title of the asset
 *                      example: Cool Cat #3460
 *                    id:
 *                      type: string
 *                      description: Infinity ID for the asset
 *                      example: 79290192270244587400858340803050549640062247427687242438135117399685291048961
 *                    address:
 *                      type: string
 *                      description: Asset's contract address
 *                      example: 0x495f947276749ce646f68ac8c248420045cb7b5e
 */
router.get('/', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  try {
    const resp = await fuzzySearchTitle(startsWithOrig as string, 10);
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });

    res.send(respStr);
    return;
  } catch (err) {
    error('Failed to get titles', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
