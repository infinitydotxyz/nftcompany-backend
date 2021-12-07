import { NULL_ADDRESS } from '@constants';
import { getProvider } from '@utils/ethers';
import { ethers } from 'ethers';
import ERC721ABI from '@base/abi/ERC721.json';
import ERC1155ABI from '@base/abi/ERC1155.json';
import { error, log } from '@utils/logger';

export async function checkERC721Ownership(doc: any, chainId: string, owner: string, address: string, id: string) {
  try {
    const provider = getProvider(chainId);
    if (!provider) {
      error('Cannot check ERC721 ownership as provider is null');
      return;
    }
    const contract = new ethers.Contract(address, ERC721ABI, provider);
    let newOwner = await contract.ownerOf(id);
    newOwner = newOwner.trim().toLowerCase();
    if (newOwner !== NULL_ADDRESS && newOwner !== owner) {
      doc.ref
        .delete()
        .then(() => {
          log('pruned erc721 after ownership change', doc.id, owner, newOwner, address, id);
        })
        .catch((err: Error) => {
          error('Error deleting stale order', doc.id, owner, err);
        });
    }
  } catch (err) {
    error('Checking ERC721 Ownership failed', err);
    if (err && err.message && err.message.indexOf('nonexistent token') > 0) {
      doc.ref
        .delete()
        .then(() => {
          log('pruned erc721 after token id non existent', doc.id, owner, address, id);
        })
        .catch((err: Error) => {
          error('Error deleting nonexistent token id order', doc.id, owner, err);
        });
    }
  }
}

export async function checkERC1155Ownership(doc: any, chainId: string, owner: string, address: string, id: string) {
  try {
    const provider = getProvider(chainId);
    if (!provider) {
      error('Cannot check ERC1155 ownership as provider is null');
      return;
    }
    const contract = new ethers.Contract(address, ERC1155ABI, provider);
    const balance = await contract.balanceOf(owner, id);
    if (owner !== NULL_ADDRESS && balance === 0) {
      console.log('stale', owner, owner, address, id);
      doc.ref
        .delete()
        .then(() => {
          console.log('pruned erc1155 after ownership change', doc.id, owner, owner, address, id, balance);
        })
        .catch((err: Error) => {
          console.error('Error deleting', doc.id, owner, err);
        });
    }
  } catch (err) {
    error('Checking ERC1155 Ownership failed', err);
  }
}
