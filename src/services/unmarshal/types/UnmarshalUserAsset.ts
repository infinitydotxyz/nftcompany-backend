import { WyvernTrait } from '@base/types/wyvern/WyvernOrder';

export interface UnmarshalUserAssetResponse {
  items_on_page: number;
  page: number;
  total_pages: number;
  total_assets: number;
  nft_assets: UnmarshalUserAsset[];
}

export interface UnmarshalUserAsset {
  asset_contract: string;
  token_id: string;
  owner: string;
  external_link: string;
  type: string;
  balance: number;
  nft_metadata: WyvernTrait[];
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
