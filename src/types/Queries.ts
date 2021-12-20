export enum OrderDirection {
  Ascending = 'asc',
  Descending = 'desc'
}

export enum NFTDataSource {
  Infinity = 'infinity',
  OpenSea = 'opensea',
  Unmarshal = 'unmarshal',
  Alchemy = 'alchemy',
  Covalent = 'covalent'
}

export const NFTDataSourceToIndex: { [key: string]: number } = {
  [NFTDataSource.Infinity]: 0,
  [NFTDataSource.OpenSea]: 1,
  [NFTDataSource.Unmarshal]: 2,
  [NFTDataSource.Alchemy]: 3,
  [NFTDataSource.Covalent]: 4
};

export const nftDataSources: { [key: string | number]: NFTDataSource } = {
  0: NFTDataSource.Infinity,
  1: NFTDataSource.OpenSea,
  2: NFTDataSource.Unmarshal,
  3: NFTDataSource.Alchemy,
  4: NFTDataSource.Covalent
};
