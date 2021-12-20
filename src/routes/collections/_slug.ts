import { StatusCode } from '@base/types/StatusCode';
import { getCollectionInfoByName } from '@services/infinity/collections/getCollectionInfoByName';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { Request, Response } from 'express';

export const getCollectionInfo = async (req: Request<{ slug: string }>, res: Response) => {
  const slug = req.params.slug;
  log('Fetching collection info for', slug);

  const { success, data, error: err } = await getCollectionInfoByName(slug, 1);

  if (success) {
    const respStr = jsonString(data);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
    return;
  }

  error('Failed to get collection info for', slug, err);
  res.sendStatus(StatusCode.InternalServerError);
};
