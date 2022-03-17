import { WyvernAssetData, WyvernTrait, WyvernTraitWithValues } from '@infinityxyz/lib/types/protocols/wyvern';
import { OPENSEA_API } from '../../../constants';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { openseaClient } from '../utils';

export async function getCollectionTraitsFromOpensea(contractAddress: string) {
  if (!ethers.utils.isAddress(contractAddress)) {
    throw new Error('invalid address');
  }

  const traitMap: { [trait_type: string]: WyvernTraitWithValues } = {};
  const url = OPENSEA_API + 'assets/';

  const { data }: AxiosResponse<{ assets: WyvernAssetData[] }> = await openseaClient.get(url, {
    params: {
      asset_contract_address: contractAddress,
      limit: 50,
      offset: 0
    }
  });

  const traits: WyvernTraitWithValues[] = [];
  if (data?.assets) {
    data.assets.forEach((item: any) => {
      item.traits.forEach((trait: WyvernTrait) => {
        // @ts-ignore
        traitMap[trait.trait_type] = traitMap[trait.trait_type] || trait;
        traitMap[trait.trait_type].values = traitMap[trait.trait_type].values || [];
        if (!traitMap[trait.trait_type].values.includes(trait.value)) {
          traitMap[trait.trait_type].values.push(trait.value);
        }
      });
    });
    Object.keys(traitMap).forEach((traitName) => {
      traits.push(traitMap[traitName]);
    });
  }

  return traits;
}
