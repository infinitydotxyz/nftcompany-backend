import { firestore } from '@base/container';
import { RawTrait, RawTraitWithValues } from '@base/types/OSNftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts, OPENSEA_API } from '@constants';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import axios from 'axios';
import { Request, Response } from 'express';

// get traits & their values of a collection
const getTraits = async (req: Request<{ id: string }>, res: Response) => {
  log('Fetching traits from NFT contract address.');
  const contractAddress = req.params.id.trim().toLowerCase();
  let resp = {};
  const traitMap: { [trait_type: string]: RawTraitWithValues } = {}; // { name: { {info) }} }
  const authKey = process.env.openseaKey;
  const url = OPENSEA_API + `assets/?asset_contract_address=${contractAddress}&limit=` + 50 + '&offset=' + 0;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };

  try {
    const { data } = await axios.get(url, options);

    const traits: RawTraitWithValues[] = [];
    if (data?.assets) {
      data.assets.forEach((item: any) => {
        item.traits.forEach((trait: RawTrait) => {
          traitMap[trait.trait_type] = (traitMap[trait.trait_type] || trait) as RawTraitWithValues;
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
    firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(contractAddress).set(resp, { merge: true });

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
};

export { getTraits };
