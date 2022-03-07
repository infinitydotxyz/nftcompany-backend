import { getExchangeAddress, getProvider } from 'utils/ethers';
import { ethers } from 'ethers';
import { JsonFragment } from '@ethersproject/abi';
import openseaAbi from 'abi/openseaExchangeContract.json';
import { NFTC_FEE_ADDRESS, WYVERN_ATOMIC_MATCH_FUNCTION, WYVERN_CANCEL_ORDER_FUNCTION } from '../../../constants';

export async function isValidNftcTxn(txnHash: string, chainId: string, actionType: 'fulfill' | 'cancel') {
  let isValid = true;
  const provider = getProvider(chainId);
  const txn = provider != null ? await provider.getTransaction(txnHash) : null;
  if (txn != null) {
    const to = txn.to;
    const txnChainId = txn.chainId;
    const data = txn.data;
    const value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi as Array<JsonFragment | ethers.utils.Fragment>);
    const decodedData = openseaIface.parseTransaction({ data, value });
    const functionName = decodedData.name;
    const args = decodedData.args;

    // checks
    const exchangeAddress = getExchangeAddress(chainId);
    if (to?.toLowerCase() !== exchangeAddress?.toLowerCase()) {
      isValid = false;
    }
    if (txnChainId !== +chainId) {
      isValid = false;
    }
    if (actionType === 'fulfill' && functionName !== WYVERN_ATOMIC_MATCH_FUNCTION) {
      isValid = false;
    }
    if (actionType === 'cancel' && functionName !== WYVERN_CANCEL_ORDER_FUNCTION) {
      isValid = false;
    }

    if (args && args.length > 0) {
      const addresses = args[0];
      if (addresses && actionType === 'fulfill' && addresses.length === 14) {
        const buyFeeRecipient = args[0][3];
        const sellFeeRecipient = args[0][10];
        if (
          buyFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = args[0][3];
        if (feeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()) {
          isValid = false;
        }
      } else {
        isValid = false;
      }
    } else {
      isValid = false;
    }
  } else {
    isValid = false;
  }
  return isValid;
}
