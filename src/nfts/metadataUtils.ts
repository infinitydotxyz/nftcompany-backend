import { metadata as doge2048NftMetadata } from './metadata/doge2048nft';

export const generateDoge2048NftMetadata = (score: number, numPlays: number, dogBalance: number) => {
  let eyeTrait: string,
    eyeTraitValue: string,
    headTrait: string,
    headTraitValue: string,
    neckTrait: string,
    neckTraitValue: string;

  // get eye trait
  for (const val of Object.values(doge2048NftMetadata.scores.levels)) {
    if (score >= val.min && score <= val.max) {
      eyeTrait = val.traitType;
      eyeTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }
  // get head trait
  for (const val of Object.values(doge2048NftMetadata.plays.levels)) {
    if (numPlays >= val.min && numPlays <= val.max) {
      headTrait = val.traitType;
      headTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }
  // get neck trait
  for (const val of Object.values(doge2048NftMetadata.dogTokenBalanceInNft.levels)) {
    if (dogBalance >= val.min && dogBalance <= val.max) {
      neckTrait = val.traitType;
      neckTraitValue = pickRandomItemFromArray(val.traitValues);
    }
  }
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
