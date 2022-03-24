import openseaAbi from 'abi/openseaExchangeContract.json';
import { bn } from 'utils';
import { getExchangeAddress, getProvider } from 'utils/ethers';
import { ethers } from 'ethers';
import { NFTC_FEE_ADDRESS, WYVERN_ATOMIC_MATCH_FUNCTION, WYVERN_CANCEL_ORDER_FUNCTION } from '../../../constants';

export async function getTxnData(txnHash: string, chainId: string, actionType: 'fulfill' | 'cancel') {
  let isValid = true;
  let from = '';
  let buyer = '';
  let seller = '';
  let value = bn(0);
  const provider = getProvider(chainId);
  const txn = provider != null ? await provider.getTransaction(txnHash) : null;
  if (txn != null) {
    from = txn.from ? txn.from.trim().toLowerCase() : '';
    const to = txn.to;
    const txnChainId = txn.chainId;
    const data = txn.data;
    value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi);
    const decodedData = openseaIface.parseTransaction({ data, value });
    const functionName = decodedData.name;
    const args = decodedData.args;

    // Checks
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
        buyer = addresses[1] ? addresses[1].trim().toLowerCase() : '';
        seller = addresses[8] ? addresses[8].trim().toLowerCase() : '';
        const buyFeeRecipient = addresses[3];
        const sellFeeRecipient = addresses[10];
        if (
          buyFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = addresses[3];
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
  return { isValid, from, buyer, seller, value };
}
