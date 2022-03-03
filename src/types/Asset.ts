import { Trait } from './Trait';

export interface Asset {
  owner: string;
  collectionAddress: string;
  tokenId: string;
  chainId: string;
  collectionName?: string;
  collectionNameSlug?: string;
  title?: string;
  traits?: Trait[];
  titleSlug?: string;
  traitValues?: string[];
  numTraits?: number;
  description?: string;
  image?: string;
  imagePreview?: string;
  traitTypes?: string[];
}
