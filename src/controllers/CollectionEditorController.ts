import { StatusCode } from '@base/types/StatusCode';
import { ethers } from 'ethers';
import { Request, Response } from 'express';

export default class CollectionEditorController {
  getCollectionInfo(req: Request<{ collection: string; user: string }>, res: Response) {
    const collectionAddress = req.params.collection;
    const user = req.params.user;

    if (!ethers.utils.isAddress(collectionAddress) || !ethers.utils.isAddress(user)) {
      res.send(StatusCode.BadRequest);
    }

    res.sendStatus(200);

    // const getAuthorizedUsers =
    /**
     * who can edit
     * * infinity admin
     * * collection owner
     * * another authorized user
     */
  }
}
