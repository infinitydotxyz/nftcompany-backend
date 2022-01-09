import { ethers } from 'ethers';
import { NextFunction, Response, Request } from 'express';
import { auth, fstrCnstnts } from '@constants';
import { error } from '../utils/logger.js';
import { StatusCode } from '@base/types/StatusCode.js';
import { firestore } from '@base/container.js';

export async function authenticateUser(req: Request<{ user: string }>, res: Response, next: NextFunction) {
  // todo: adi for testing only
  // return true;

  const userId = req.params.user.trim().toLowerCase();
  const signature = req.header(auth.signature);
  const message = req.header(auth.message);
  if (!signature || !message) {
    res.sendStatus(StatusCode.Unauthorized);
    return;
  }
  try {
    // verify signature
    const sign = JSON.parse(signature);
    const actualAddress = ethers.utils.verifyMessage(message, sign).toLowerCase();
    if (actualAddress === userId) {
      next();
      return;
    }
  } catch (err) {
    error('Cannot authenticate user ' + userId);
    error(err);
  }
  res.sendStatus(StatusCode.Unauthorized);
}

export enum CollectionAuthType {
  Editor = 'editor',
  Creator = 'creator',
  Admin = 'admin'
}

/**
 * ASSUMES AUTHENTICATION HAS ALREADY BEEN HANDLED
 *
 * adds the authType property to locals
 */
export function authorizeCollectionEditor(
  req: Request<{ user: string; collection: string }>,
  res: Response<any, { authType: CollectionAuthType }>,
  next: NextFunction
) {
  const asyncHandler = async () => {
    const userAddress = req.params.user.trim?.()?.toLowerCase?.();
    const contractAddress = req.params.collection?.trim?.()?.toLowerCase?.();

    const creatorDocRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(contractAddress)
      .collection(fstrCnstnts.AUTH_COLL)
      .doc(fstrCnstnts.CREATOR_DOC);

    let creatorObj: { creator: string; hash: string } | undefined = (await creatorDocRef.get()).data() as any;

    if (!creatorObj?.creator) {
      const etherscanApiKey = process.env.etherscanApiKey;
      const provider = new ethers.providers.EtherscanProvider(undefined, etherscanApiKey);

      const txHistory = await provider.getHistory(contractAddress);
      const creationTx = txHistory.find((tx) => {
        return (tx as any)?.creates?.toLowerCase?.() === contractAddress;
      });

      const creator = creationTx?.from?.toLowerCase?.() ?? '';
      const hash = creationTx?.hash ?? '';
      creatorObj = {
        creator,
        hash
      };
      // save creator
      await creatorDocRef.set(creatorObj);
    }

    if (userAddress === creatorObj.creator) {
      // creator is authorized
      res.locals.authType = CollectionAuthType.Creator;
      next();
      return;
    }

    const editorsDocRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(contractAddress)
      .collection(fstrCnstnts.AUTH_COLL)
      .doc(fstrCnstnts.EDITORS_DOC);

    const editors = (await editorsDocRef.get()).data();
    if (editors?.[userAddress]?.authorized) {
      // editor is authorized
      res.locals.authType = CollectionAuthType.Editor;
      next();
      return;
    }

    const adminDocRef = firestore.collection(fstrCnstnts.AUTH_COLL).doc(fstrCnstnts.ADMINS_DOC);

    const admins = (await adminDocRef.get()).data();

    if (admins?.[userAddress]?.authorized) {
      // admin is authorized
      res.locals.authType = CollectionAuthType.Admin;
      next();
      return;
    }

    res.sendStatus(StatusCode.Unauthorized);
  };

  asyncHandler()
    .then(() => {})
    .catch((err) => {
      error(`error occurred while authorizing user`);
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
}
