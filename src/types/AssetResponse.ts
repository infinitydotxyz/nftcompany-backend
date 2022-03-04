import { AlchemyUserAssetResponse, AlchemyUserAsset } from '@services/alchemy/types/AlchemyUserAsset';
import { CovalentWalletBalanceItem } from '@services/covalent/types/CovalentNFTMetadata';
import { UnmarshalUserAsset, UnmarshalUserAssetResponse } from '@services/unmarshal/types/UnmarshalUserAsset';
import { WyvernAssetData } from './wyvern/WyvernOrder';

export interface AssetResponse extends AlchemyUserAssetResponse, UnmarshalUserAssetResponse {
  count: number;
  assets: AlchemyUserAsset[] | WyvernAssetData[] | CovalentWalletBalanceItem[] | UnmarshalUserAsset[];
}
