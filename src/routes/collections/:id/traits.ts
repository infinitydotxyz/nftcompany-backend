import { firestore } from '@base/container';
import { RawTrait } from '@base/types/OSNftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts, OPENSEA_API } from '@constants';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import axios from 'axios';
import { Router } from 'express';
const router = Router();

// get traits & their values of a collection
router.get('/:id/traits', async (req, res) => {
  log('Fetching traits from NFT contract address.');
  const id = req.params.id.trim().toLowerCase();
  let resp = {};
  const traitMap: any = {}; // { name: { {info) }} }
  const authKey = process.env.openseaKey;
  const url = OPENSEA_API + `assets/?asset_contract_address=${id}&limit=` + 50 + '&offset=' + 0;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };
  try {
    const { data } = await axios.get(url, options);
    const traits: any[] = [];
    if (data?.assets) {
      data.assets.forEach((item: any) => {
        item.traits.forEach((trait: RawTrait) => {
          traitMap[trait.trait_type] = traitMap[trait.trait_type] || trait;
          traitMap[trait.trait_type].values = traitMap[trait.trait_type].values || [];
          if (traitMap[trait.trait_type].values.indexOf(trait.value) < 0) {
            traitMap[trait.trait_type].values.push(trait.value);
          }
        });
      });
      Object.keys(traitMap).forEach((traitName) => {
        traits.push(traitMap[traitName]);
      });
    }

    resp = {
      traits
    };
    // store in firestore for future use
    firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(id).set(resp, { merge: true });

    // return response
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=300',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
