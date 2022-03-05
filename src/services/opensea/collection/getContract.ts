import { CollectionInfo, Links } from 'infinity-types/types/NftInterface';
import { getSearchFriendlyString } from '@utils/formatters';
import { error } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { openseaClient } from '../utils';

interface ContractResponse {
  collection: Collection;
  address: string;
  asset_contract_type: string;
  created_date: string;
  name: string;
  nft_version: string;
  opensea_version?: any;
  owner: number;
  schema_name: string;
  symbol: string;
  total_supply?: any;
  description: string;
  external_link: string;
  image_url: string;
  default_to_fiat: boolean;
  dev_buyer_fee_basis_points: number;
  dev_seller_fee_basis_points: number;
  only_proxied_transfers: boolean;
  opensea_buyer_fee_basis_points: number;
  opensea_seller_fee_basis_points: number;
  buyer_fee_basis_points: number;
  seller_fee_basis_points: number;
  payout_address?: any;
}

export interface Collection {
  banner_image_url: string;
  chat_url?: any;
  created_date: string;
  default_to_fiat: boolean;
  description: string;
  dev_buyer_fee_basis_points: string;
  dev_seller_fee_basis_points: string;
  discord_url: string;
  display_data: Displaydata;
  external_url: string;
  featured: boolean;
  featured_image_url: string;
  hidden: boolean;
  safelist_request_status: string;
  image_url: string;
  is_subject_to_whitelist: boolean;
  large_image_url: string;
  medium_username?: any;
  name: string;
  only_proxied_transfers: boolean;
  opensea_buyer_fee_basis_points: string;
  opensea_seller_fee_basis_points: string;
  payout_address?: string;
  require_email: boolean;
  short_description?: any;
  slug: string;
  telegram_url?: any;
  twitter_username: string;
  instagram_username?: any;
  wiki_url: string;
}

interface Displaydata {
  card_display_style: string;
}

export async function getCollectionLinks(collectionAddress: string): Promise<Links | undefined> {
  try {
    const collectionRespone: AxiosResponse<ContractResponse> = await openseaClient.get(
      `https://api.opensea.io/api/v1/asset_contract/${collectionAddress}`
    );
    const data = collectionRespone?.data?.collection;
    return {
      timestamp: new Date().getTime(),
      discord: data.discord_url ?? '',
      external: data.external_url ?? '',
      medium: data?.medium_username ? `https://medium.com/${data.medium_username}` : '',
      slug: data?.slug ?? '',
      telegram: data.telegram_url ?? '',
      twitter: data?.twitter_username ? `https://twitter.com/${data.twitter_username}` : '',
      instagram: data?.instagram_username ? `https://instagram.com/${data.instagram_username}` : '',
      wiki: data?.wiki_url ?? ''
    };
  } catch (e) {
    error('Error occurred while fetching collection from opensea');
    error(e);
  }
}

export async function getCollectionInfoFromOpensea(
  collectionAddress: string
): Promise<(CollectionInfo & { slug: string }) | undefined> {
  try {
    const collectionRespone: AxiosResponse<ContractResponse> = await openseaClient.get(
      `https://api.opensea.io/api/v1/asset_contract/${collectionAddress}`
    );
    const data = collectionRespone?.data?.collection;
    return {
      chain: '', // does not return the chain
      searchCollectionName: getSearchFriendlyString(data?.slug ?? ''),
      description: data?.description,
      bannerImage: data?.banner_image_url,
      profileImage: data?.image_url,
      traits: [], // Does not return traits for the collection
      hasBlueCheck: false,
      address: collectionAddress,
      name: data?.name,
      cardImage: data?.featured_image_url,
      openseaUrl: data?.slug ? `https://opensea.io/collection/${data.slug}` : '',
      chainId: collectionRespone?.data?.symbol === 'ETH' ? '1' : '137',
      benefits: [],
      partnerships: [],
      slug: data.slug ?? ''
    };
  } catch (e) {
    error('Error occurred while fetching collection from opensea');
    error(e);
  }
}
