import { POLYGON_WETH_ADDRESS, WETH_ADDRESS } from '../constants';
import { ListingType } from '@infinityxyz/lib/types/core';
import BigNumber from 'bignumber.js';
import { List, uniqBy } from 'lodash';

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
  // @ts-expect-error not sure, why do we not use BigNumber from ethers utils?
  const bigNum = BigNumber(num);
  return bigNum;
}

export function toFixed5(num: BigNumber.Value) {
  return +bn(num).toFixed(5);
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
