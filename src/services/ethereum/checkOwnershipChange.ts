import { NULL_ADDRESS } from '../../constants';
import { getProvider } from 'utils/ethers';
import { ethers } from 'ethers';
import ERC721ABI from 'abi/ERC721.json';
import ERC1155ABI from 'abi/ERC1155.json';
import { error } from '@infinityxyz/lib/utils';

export async function checkOwnershipChange(doc: any): Promise<boolean> {
  const order = doc.data();
  const side = order.side;
  const schema = order.metadata.schema;
  const address = order.metadata.asset.address;
  const id = order.metadata.asset.id;
  const chainId = order.metadata.chainId;
  if (side === 1) {
    // listing
    const maker = order.maker;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      return await checkERC721Ownership(doc, chainId, maker, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      return await checkERC1155Ownership(doc, chainId, maker, address, id);
    }
  } else if (side === 0) {
    // offer
    const owner = order.metadata.asset.owner;
    if (schema && schema.trim().toLowerCase() === 'erc721') {
      return await checkERC721Ownership(doc, chainId, owner, address, id);
    } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
      return await checkERC1155Ownership(doc, chainId, owner, address, id);
    }
  }
  return false;
}

export async function getERC721Owner(address: string, tokenId: string, chainId: string) {
  try {
    const provider = getProvider(chainId);
    if (provider == null) {
      error('Cannot check ERC721 ownership as provider is null');
      return '';
    }
    const contract = new ethers.Contract(address, ERC721ABI, provider);
    let newOwner = await contract.ownerOf(tokenId);
    newOwner = newOwner.trim().toLowerCase();
    return newOwner;
  } catch (err) {
    return '';
  }
}

export async function checkERC721Ownership(doc: any, chainId: string, owner: string, address: string, id: string) {
  try {
    const newOwner = await getERC721Owner(address, id, chainId);
    if (newOwner !== NULL_ADDRESS && newOwner !== owner) {
      return true;
    }
  } catch (err) {
    error('Checking ERC721 Ownership failed', err);
    if (err?.message?.indexOf('nonexistent token') > 0) {
      return true;
    }
  }
  return false;
}

export async function checkERC1155Ownership(doc: any, chainId: string, owner: string, address: string, id: string) {
  try {
    const provider = getProvider(chainId);
    if (provider == null) {
      error('Cannot check ERC1155 ownership as provider is null');
      return false;
    }
    const contract = new ethers.Contract(address, ERC1155ABI, provider);
    let balance = await contract.balanceOf(owner, id);
    balance = balance?.toNumber?.();
    if (owner !== NULL_ADDRESS && balance === 0) {
      return true;
    }
  } catch (err) {
    error('Checking ERC1155 Ownership failed', err);
  }
  return false;
}
