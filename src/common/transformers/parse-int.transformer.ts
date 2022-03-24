import { BadRequestException } from '@nestjs/common';
import { TransformFnParams } from 'class-transformer';

interface ParseIntTransformerOptions {
  /**
   * Defaults to 10
   */
  base?: 10 | 16;

  /**
   * Defaults to false
   */
  allowNaN?: boolean;

  /**
   * Defaults to false
   */
  allowInfinity?: boolean;

  /**
   * Inclusive
   */
  min?: number;

  /**
   * Inclusive
   */
  max?: number;
}

export function parseIntTransformer(options?: ParseIntTransformerOptions) {
  return (params: TransformFnParams) => {
    const base = options?.base ?? 10;
    const parsed = parseInt(params.value, base);

    if (!options?.allowNaN && Number.isNaN(parsed)) {
      throw new BadRequestException(`${params.key} must be a base: ${base} integer`);
    }

    if (!options?.allowInfinity && !Number.isFinite(parsed)) {
      throw new BadRequestException(`${params.key} must be finite`);
    }

    if (typeof options?.max === 'number' && parsed > options.max) {
      throw new BadRequestException(`${params.key} out of bounds, max value: ${options.max}`);
    }

    if (typeof options?.min === 'number' && parsed < options.min) {
      throw new BadRequestException(`${params.key} out of bounds, min value: ${options.max}`);
    }

    return parsed;
  };
}
