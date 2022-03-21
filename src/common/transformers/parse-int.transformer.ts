import { BadRequestException } from '@nestjs/common';
import { TransformFnParams } from 'class-transformer';

interface ParseIntTransformerOptions {
  /**
   * defaults to 10
   */
  base?: 10 | 16;

  /**
   * defaults to false
   */
  allowNaN?: boolean;

  /**
   * defaults to false
   */
  allowInfinity?: boolean;

  /**
   * inclusive
   */
  min?: number;

  /**
   * inclusive
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
