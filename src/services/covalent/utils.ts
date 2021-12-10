import { isTokenVerified } from '@services/infinity/collections/isTokenVerified';
import { getSearchFriendlyString } from '@utils/formatters';

export async function covalentAssetDataToListing(chainId: string, data: any) {
  const address = data.contract_address;
  const collectionName = data.contract_name;
  let id = '';
  let title = '';
  let schema = '';
  let description = '';
  let image = '';
  let imagePreview = '';
  let numTraits = 0;
  const traits = [];
  const nftData = data.nft_data;
  if (nftData && nftData.length > 0) {
    const firstNftData = nftData[0];
    id = firstNftData.token_id;
    for (const std of firstNftData.supports_erc) {
      if (std.trim().toLowerCase() === 'erc721') {
        schema = 'ERC721';
      } else if (std.trim().toLowerCase() === 'erc1155') {
        schema = 'ERC1155';
      }
    }
    const externalData = firstNftData.external_data;
    if (externalData) {
      title = externalData.name;
      description = externalData.description;
      image = externalData.image;
      imagePreview = externalData.image_512;
      const attrs = externalData.attributes;
      if (attrs && attrs.length > 0) {
        for (const attr of attrs) {
          numTraits++;
          traits.push({ traitType: attr.trait_type, traitValue: String(attr.value) });
        }
      }
    }
  }
  const listing = {
    isListing: false,
    hasBlueCheck: await isTokenVerified(address),
    schema,
    chainId,
    asset: {
      address,
      id,
      collectionName,
      description,
      image,
      imagePreview,
      searchCollectionName: getSearchFriendlyString(collectionName),
      searchTitle: getSearchFriendlyString(title),
      title,
      numTraits,
      traits
    }
  };
  return listing;
}
