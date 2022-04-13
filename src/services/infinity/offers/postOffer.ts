import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { log } from '@infinityxyz/lib/utils';
import { prepareEmail } from '../email/prepareEmail';
import { updateNumOrders } from '../orders/updateNumOrders';
import { getProvider } from 'utils/ethers';
import { ethers } from 'ethers';
import ERC721ABI from 'abi/ERC721.json';

export async function postOffer(maker: string, payload: any, batch: any, numOrders: number, hasBonus: boolean) {
  log('Writing offer to firestore for user', maker);
  let taker = payload.metadata?.asset?.owner?.trim?.()?.toLowerCase?.() ?? ''; // Get owner if undefined
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();
  payload.metadata.createdAt = Date.now();
  if (
    (!taker || taker === '0x0000000000000000000000000000000000000000') &&
    payload.metadata.schema === 'ERC721' &&
    payload.metadata.chainId
  ) {
    try {
      const provider = getProvider(payload.metadata.chainId);
      if (provider) {
        const contract = new ethers.Contract(tokenAddress, ERC721ABI, provider);
        taker = await contract.ownerOf(tokenId);
        payload.metadata.asset.owner = taker?.toLowerCase?.();
      }
    } catch (err: any) {
      console.log(err);
    }
  }

  if (payload.metadata.schema === 'ERC721' && !payload.metadata.asset.owner) {
    throw new Error('invalid order, no owner');
  }

  // Store data in offers of maker
  const offerRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(firestore.getDocId({ tokenAddress, tokenId, basePrice }));
  batch.set(offerRef, payload, { merge: true });

  log('updating num offers since offer does not exist');
  // Update num user offers made
  updateNumOrders(batch, maker, numOrders, hasBonus, 0);

  if (taker) {
    void prepareEmail(taker, payload, 'offerMade');
  }
}
