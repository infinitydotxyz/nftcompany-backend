/**
 * @typedef {Object} WyvernTraitWithValues
 * @property {string} trait_type
 * @property {number} trait_count
 * @property {string} display_type
 * @property {array<string>} values
 * @property {string} max_value
 */

export interface WyvernTraitWithValues {
  trait_type: string;
  trait_count: number;
  display_type?: string;
  values: string[];
  max_value?: any;
}
