import { metadata as doge2048NftMetadata } from './metadata/doge2048nft';
import md5 from 'md5';

export class DogeMetadata {
  eyeTrait?: string;
  eyeTraitValue?: string;
  headTrait?: string;
  headTraitValue?: string;
  neckTrait?: string;
  neckTraitValue?: string;

  toString = (): string => {
    return `${this.eyeTrait} ${this.eyeTraitValue} ${this.headTrait} ${this.headTraitValue} ${this.neckTrait} ${this.neckTraitValue}`;
  };

  hash = (): string => {
    return md5(this.toString());
  };
}

export const generateDoge2048NftMetadata = (score: number, numPlays: number, dogBalance: number): DogeMetadata => {
  let result: DogeMetadata = new DogeMetadata();

  // get eye trait
  for (const val of Object.values(doge2048NftMetadata.scores.levels)) {
    if (score >= val.min && score <= val.max) {
      result.eyeTrait = val.traitType;
      result.eyeTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }
  // get head trait
  for (const val of Object.values(doge2048NftMetadata.plays.levels)) {
    if (numPlays >= val.min && numPlays <= val.max) {
      result.headTrait = val.traitType;
      result.headTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }
  // get neck trait
  for (const val of Object.values(doge2048NftMetadata.dogTokenBalanceInNft.levels)) {
    if (dogBalance >= val.min && dogBalance <= val.max) {
      result.neckTrait = val.traitType;
      result.neckTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }

  return result;
};

export const getDoge2048NftLevelId = (score: number, numPlays: number, dogBalance: number): string => {
  let scoreLevel: string, playsLevel: string, dogBalanceLevel: string;
  // get eye level
  for (const [key, val] of Object.entries(doge2048NftMetadata.scores.levels)) {
    if (score >= val.min && score <= val.max) {
      scoreLevel = key;
    }
  }
  // get head level
  for (const [key, val] of Object.entries(doge2048NftMetadata.scores.levels)) {
    if (numPlays >= val.min && numPlays <= val.max) {
      playsLevel = key;
    }
  }
  // get neck level
  for (const [key, val] of Object.entries(doge2048NftMetadata.scores.levels)) {
    if (dogBalance >= val.min && dogBalance <= val.max) {
      dogBalanceLevel = key;
    }
  }
  return 'score:' + scoreLevel + '::numPlays:' + playsLevel + '::dogBalance:' + dogBalanceLevel;
};

const pickRandomItemFromArray = (arr: string[]): string => {
  if (arr.length > 0) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  return '';
};
