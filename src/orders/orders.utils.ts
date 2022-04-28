import { OBOrder, OBOrderItem, OBTokenInfo } from '@infinityxyz/lib/types/core';
import { getExchangeAddress, NULL_ADDRESS, NULL_HASH } from '@infinityxyz/lib/utils';
import { BytesLike } from 'ethers';
import { solidityKeccak256, parseEther, defaultAbiCoder, keccak256 } from 'ethers/lib/utils';
import { SignedOBOrderDto } from './dto/signed-ob-order.dto';

export type OrderHashTokensParam = Pick<OBTokenInfo, 'tokenId' | 'numTokens'>;
export type OrderHashNftsParam = Pick<OBOrderItem, 'collectionAddress'> & {
  tokens: OrderHashTokensParam[];
};
export type OrderHashParams = Pick<
  OBOrder,
  | 'startPriceEth'
  | 'endPriceEth'
  | 'startTimeMs'
  | 'endTimeMs'
  | 'execParams'
  | 'extraParams'
  | 'minBpsToSeller'
  | 'numItems'
  | 'nonce'
  | 'isSellOrder'
  | 'makerAddress'
> & { nfts: OrderHashNftsParam[] };

export function getOrderIdFromSignedOrder(order: SignedOBOrderDto, makerAddress: string) {
  const params = getOrderHashParamsFromSignedOrder(order, makerAddress);
  const orderId = getOrderId(order.chainId, getExchangeAddress(order.chainId), params);
  return orderId;
}

function getOrderHashParamsFromSignedOrder(signedOrder: SignedOBOrderDto, makerAddress: string) {
  const orderHashParams: OrderHashParams = {
    startPriceEth: signedOrder.startPriceEth,
    endPriceEth: signedOrder.endPriceEth,
    startTimeMs: signedOrder.startTimeMs,
    endTimeMs: signedOrder.endTimeMs,
    execParams: signedOrder.execParams,
    extraParams: signedOrder.extraParams,
    minBpsToSeller: signedOrder.minBpsToSeller,
    numItems: signedOrder.signedOrder.nfts.reduce((numItems: number, nft) => numItems + nft.tokens.length, 0),
    nonce: signedOrder.nonce,
    isSellOrder: signedOrder.signedOrder.isSellOrder,
    makerAddress,
    nfts: signedOrder.signedOrder.nfts.map((item) => {
      return {
        collectionAddress: item.collection,
        tokens: item.tokens
      };
    })
  };
  return orderHashParams;
}

export function getOrderId(chainId: string, exchangeAddr: string, orderHashParams: OrderHashParams): string {
  try {
    const fnSign =
      'Order(bool isSellOrder,address signer,uint256[] constraints,OrderItem[] nfts,address[] execParams,bytes extraParams)OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
    const orderTypeHash = solidityKeccak256(['string'], [fnSign]);
    // console.log('Order type hash', orderTypeHash);

    const constraints = [
      orderHashParams.numItems,
      parseEther(String(orderHashParams.startPriceEth)),
      parseEther(String(orderHashParams.endPriceEth)),
      Math.floor(orderHashParams.startTimeMs / 1000),
      Math.floor(orderHashParams.endTimeMs / 1000),
      orderHashParams.minBpsToSeller,
      orderHashParams.nonce
    ];
    const execParams = [orderHashParams.execParams.complicationAddress, orderHashParams.execParams.currencyAddress];
    const extraParams = defaultAbiCoder.encode(['address'], [orderHashParams.extraParams.buyer || NULL_ADDRESS]);

    const constraintsHash = keccak256(
      defaultAbiCoder.encode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], constraints)
    );
    // console.log('constraints hash', constraintsHash);
    const nftsHash = _getNftsHash(orderHashParams.nfts);
    const execParamsHash = keccak256(defaultAbiCoder.encode(['address', 'address'], execParams));
    // console.log('execParamsHash', execParamsHash);

    const calcEncode = defaultAbiCoder.encode(
      ['bytes32', 'bool', 'address', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
      [
        orderTypeHash,
        orderHashParams.isSellOrder,
        orderHashParams.makerAddress,
        constraintsHash,
        nftsHash,
        execParamsHash,
        keccak256(extraParams)
      ]
    );
    const orderHash = keccak256(calcEncode);
    return orderHash;
  } catch (e) {
    console.error('Error calculating orderId', e);
  }
  return NULL_HASH;
}

function _getNftsHash(nfts: OrderHashNftsParam[]): BytesLike {
  const fnSign = 'OrderItem(address collection,TokenInfo[] tokens)TokenInfo(uint256 tokenId,uint256 numTokens)';
  const typeHash = solidityKeccak256(['string'], [fnSign]);
  // console.log('Order item type hash', typeHash);

  const hashes = [];
  for (const nft of nfts) {
    const hash = keccak256(
      defaultAbiCoder.encode(
        ['bytes32', 'uint256', 'bytes32'],
        [typeHash, nft.collectionAddress, _getTokensHash(nft.tokens)]
      )
    );
    hashes.push(hash);
  }
  const encodeTypeArray = hashes.map(() => 'bytes32');
  const nftsHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));
  // console.log('nftsHash', nftsHash);
  return nftsHash;
}

function _getTokensHash(tokens: OrderHashTokensParam[]): BytesLike {
  const fnSign = 'TokenInfo(uint256 tokenId,uint256 numTokens)';
  const typeHash = solidityKeccak256(['string'], [fnSign]);
  // console.log('Token info type hash', typeHash);

  const hashes = [];
  for (const token of tokens) {
    const hash = keccak256(
      defaultAbiCoder.encode(['bytes32', 'uint256', 'uint256'], [typeHash, token.tokenId, token.numTokens])
    );
    hashes.push(hash);
  }
  const encodeTypeArray = hashes.map(() => 'bytes32');
  const tokensHash = keccak256(defaultAbiCoder.encode(encodeTypeArray, hashes));
  // console.log('tokensHash', tokensHash);
  return tokensHash;
}
