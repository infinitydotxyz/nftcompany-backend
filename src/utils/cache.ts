import NodeCache from 'node-cache'

export const ONE_DAY_IN_SECS = 86400;

const cache = new NodeCache();

export function cacheGet(key: string) {
  return cache.get(key);
}

export function cacheSet(key: string, data: any, ttl: number = ONE_DAY_IN_SECS) {
  return cache.set(key, data, ttl);
}
