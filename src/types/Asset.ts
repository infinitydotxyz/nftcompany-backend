import { WyvernAssetData } from './WyvernOrder';
import { Trait } from './Trait';

/**
 * @typedef { import("./WyvernOrder").WyvernAssetData} WyvernAssetData
 */
/**
 * @typedef { import("./Trait").Trait} Trait
 */

/**
 * @property {string} title
 * @property {Trait[]} traits
 * @property {string} searchTitle
 * @property {string[]} traitValues
 * @property {number} numTraits
 * @property {WyvernAssetData} rawData
 * @property {string} collectionName
 * @property {string} id
 * @property {string} description
 * @property {string} image
 * @property {string} searchCollectionName
 * @property {string} address
 * @property {string} imagePreview
 * @property {string[]} traitTypes
 */

export interface Asset {
  title: string;
  traits: Trait[];
  searchTitle: string;
  traitValues: string[];
  numTraits: number;
  rawData: WyvernAssetData;
  collectionName: string;
  id: string;
  description: string;
  image: string;
  searchCollectionName: string;
  address: string;
  imagePreview: string;
  traitTypes: string[];
}
