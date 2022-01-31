export interface NftMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: NftAttribute[];
}

export interface NftAttribute {
  trait_type?: string;
  value?: string | number;
  display_type?: string;
}
