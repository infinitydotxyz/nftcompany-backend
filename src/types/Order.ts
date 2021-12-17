/**
 * @typedef {Object} Order
 * @property {string} listingTime
 * @property {number} v
 * @property {string} extra
 * @property {string} takerRelayerFee
 * @property {string} feeRecipient
 * @property {string} takerProtocolFee
 * @property {string} staticTarget
 * @property {number} side
 * @property {string} basePrice
 * @property {string} salt
 * @property {string} r
 * @property {number} howToCall
 * @property {string} exchange
 * @property {string} s
 * @property {number} feeMethod
 * @property {string} expirationTime
 * @property {string} replacementPattern
 * @property {number} saleKind
 * @property {string} quantity
 * @property {string} maker
 * @property {string} makerProtocolFee
 * @property {string} calldata
 * @property {string} makerReferrerFee
 * @property {string} taker
 * @property {string} target
 * @property {string} hash
 * @property {string} makerRelayerFee
 * @property {string} staticExtradata
 * @property {string} paymentToken
 */

export interface Order {
  listingTime: string;
  v: number;
  extra: string;
  takerRelayerFee: string;
  feeRecipient: string;
  takerProtocolFee: string;
  staticTarget: string;
  side: number;
  basePrice: string;
  salt: string;
  r: string;
  howToCall: number;
  exchange: string;
  s: string;
  feeMethod: number;
  expirationTime: string;
  replacementPattern: string;
  saleKind: number;
  quantity: string;
  maker: string;
  makerProtocolFee: string;
  calldata: string;
  makerReferrerFee: string;
  taker: string;
  target: string;
  hash: string;
  makerRelayerFee: string;
  staticExtradata: string;
  paymentToken: string;
}
