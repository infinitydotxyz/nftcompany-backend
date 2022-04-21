/* eslint-disable no-case-declarations */
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { BadRequestException } from '@nestjs/common';
import { TransformFnParams } from 'class-transformer';

export function parseBoolTransformer(options: { optional?: boolean } = {}) {
  return (params: TransformFnParams): boolean | undefined => {
    if (options.optional && params.value == null) {
      return undefined;
    }

    switch (typeof params.value) {
      case 'boolean':
        return params.value;

      case 'string':
        const normalized = trimLowerCase(params.value);
        if (normalized === 'true') {
          return true;
        } else if (normalized === 'false') {
          return false;
        }
        throw new BadRequestException(`${params.key} must be a boolean`);

      default:
        throw new BadRequestException(`${params.key} must be a boolean`);
    }
  };
}
