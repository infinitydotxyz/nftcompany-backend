import { getChainId, getProvider } from './ethers';
import { POLYGON_WETH_ADDRESS, WETH_ADDRESS } from '../constants';
import { ListingType, StatusCode } from '@infinityxyz/lib/types/core';
import BigNumber from 'bignumber.js';
import { List, uniqBy } from 'lodash';
import { ParsedQs } from 'qs';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';
import { createHash } from 'crypto';

export const base64Encode = (data: string) => Buffer.from(data).toString('base64');

export const base64Decode = (data?: string) => Buffer.from(data ?? '', 'base64').toString();

export async function sleep(ms: number) {
  return await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

export function deepCopy(object: any) {
  return JSON.parse(JSON.stringify(object));
}

export function bn(num: BigNumber.Value) {
  // @ts-expect-error not sure
  const bigNum = BigNumber(num);
  // Console.log(num + '   ====== bigNUm ' + bigNum);
  // Console.log(__line);
  return bigNum;
}

export function toFixed5(num: BigNumber.Value) {
  // eslint-disable-next-line no-undef
  // Console.log(__line);
  return +bn(num).toFixed(5);
  // Return +num.toString().match(/^-?\d+(?:\.\d{0,5})?/)[0];
}

export function getUniqueItemsByProperties<T>(items: List<T> | null | undefined, property: string) {
  return uniqBy(items, property);
}

export function getWeekNumber(d: Date) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}

export function getNextWeek(weekNumber: number, year: number) {
  const nextWeek = (weekNumber + 1) % 53;
  return nextWeek === 0 ? [year + 1, nextWeek + 1] : [year, nextWeek];
}

// Validate api inputs; return a StatusCode if error;
// Example: validateInputs({ user, listType }, ['user']) // require 'user'
interface validateInputsProps {
  listType?: string | ParsedQs | string[] | ParsedQs[] | undefined;
  ids?: string; // Comma separated string of ids.
  user?: string | undefined;
  sourceName?: string | undefined;
  chain?: string | undefined;
  chainId?: string | undefined;
  tokenAddress?: string | undefined;
  tokenId?: string | undefined;
}

export function validateInputs(props: validateInputsProps, requiredProps: string[] = []): number {
  const { listType, chain, user, tokenAddress } = props;

  for (const requiredProp of requiredProps) {
    if (!(props as any)[requiredProp]) {
      error(`Required input: ${requiredProp}`);
      return StatusCode.BadRequest;
    }
  }

  if (
    listType &&
    listType !== ListingType.FixedPrice &&
    listType !== ListingType.DutchAuction &&
    listType !== ListingType.EnglishAuction
  ) {
    error(`Input error - invalid list type: ${listType as string}`);
    return StatusCode.BadRequest;
  }

  if (chain) {
    const chainId = getChainId(chain);
    const provider = getProvider(chainId);
    if (!provider) {
      error('Invalid chainId ', chain);
      return StatusCode.BadRequest;
    }
  }

  if (user && !user.startsWith('0x')) {
    error(`Invalid user address`, user);
    return StatusCode.BadRequest;
  }

  if (tokenAddress && !tokenAddress.startsWith('0x')) {
    error(`Invalid tokenAddress`, tokenAddress);
    return StatusCode.BadRequest;
  }

  return 0;
}

export function getPaymentTokenAddress(listingType?: string, chainId?: string): string | undefined {
  if (chainId === '1') {
    return listingType === ListingType.EnglishAuction ? WETH_ADDRESS : undefined;
  } else if (chainId === '137') {
    return POLYGON_WETH_ADDRESS;
  }
}

export function hexToDecimalTokenId(tokenId: string): string {
  if (tokenId?.startsWith('0x')) {
    tokenId = String(parseInt(tokenId, 16));
  }
  return tokenId;
}

export function calcPercentChange(prev = NaN, current: number) {
  const change = prev - current;
  const decimal = change / Math.abs(prev);
  const percent = decimal * 100;

  if (Number.isNaN(percent)) {
    return current;
  }

  return percent;
}

export function getDocIdHash({
  collectionAddress,
  tokenId,
  chainId
}: {
  collectionAddress: string;
  tokenId: string;
  chainId: string;
}) {
  const data = chainId.trim() + '::' + trimLowerCase(collectionAddress) + '::' + tokenId.trim();
  return createHash('sha256').update(data).digest('hex').trim().toLowerCase();
}
