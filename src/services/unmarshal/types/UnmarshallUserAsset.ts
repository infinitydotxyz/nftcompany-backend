import { RawTrait } from '@base/types/OSNftInterface';

export interface UnmarshallUserAsset {
  asset_contract: string;
  token_id: string;
  owner: string;
  external_link: string;
  type: string;
  balance: number;
  nft_metadata: RawTrait[];
  issuer_specific_data: IssuerSpecificData;
  price: string;
  animation_url: string;
  description: string;
}

interface IssuerSpecificData {
  entire_response: string;
  image_url: string;
  name: string;
}
